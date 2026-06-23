> # Step 2:文章 store 接入「获取文章 API」(拆分第二步,落地新功能)
>
> **背景**:Step 1 已把目录 store 迁到 `stores/reader/catalogue.js`(裸名生命周期)。本步新建**文章 store**,把"点击叶子节点 → 请求正文 API → 渲染 md"这条链接通,并删掉临时桩 `getLeafContent`/`buildSampleMarkdown`。
>
> **接口**:`POST {VITE_API_BASE_URL}/v1/article/show`,body `{article:{id}}`,响应经拦截器解包后 `getArticle(id)` resolve 出 `{article:{id, content, createdAt}}`。`content` 是 md 文本;`createdAt` 形如 `YYYY-MM-DD`(叶子节点本身只有 id/type/name,**正文与创建时间都由本 API 提供**)。
>
> ---
>
> **决策点**:
> 1. **文章 store 用裸名**(`status`/`reloadNonce`/`startLoading`/`setArticle`/`markFailed`/`requestReload`)——与 `catalogue.js`/`book.js` 同形。它和目录 store 是**两个独立单例**,裸名不冲突。
> 2. **桥在 `activeLeafId`**:目录 store 新增 computed `activeLeafId`(选中叶子→叶子 id,否则 null);`useArticleSync` 监听它来触发请求。两套状态机由此解耦。
> 3. **`articleHtml` 搬家**:从目录 store 移到文章 store,改读 `article.content`(不再是 `getLeafContent`)。目录 store 同时删 `getLeafContent`、`renderMarkdownToHtml` 两个导入。
> 4. **`useArticleSync` 不用 `immediate`**:挂载时 `activeLeafId` 恒为 null(默认选中根=非叶),叶子只会在用户点击后出现,非 immediate 的 watch 自然捕获。这与 `useCatalogueSync`(路由 id 挂载即在,需 immediate)是**有意的不对称**。
> 5. **不缓存**:每次叶子切换都请求;`startLoading` 清空旧文章。简单优先,后续要缓存再说。
>
> **触及文件(共 7 个)**:
> - 新增 ×3:`api/article.js`(§1)、`stores/reader/article.js`(§2)、`composables/useArticleSync.js`(§4)
> - 改 ×3:`stores/reader/catalogue.js`(§3,加 `activeLeafId`/删 `articleHtml`)、`components/article/ArticlePane.vue`(§5,接第二个 store + 状态分支)、`pages/ArticleReader.vue`(§6,挂 `useArticleSync`)
> - 删桩 ×1:`lib/treeQuery.js`(§7)
>
> **落地顺序**:§1→§7。注意 §3(目录 store 删 `articleHtml`)、§5(`ArticlePane` 改读 `articleStore.articleHtml`)、§7(删 `getLeafContent`)**必须一起落**——中间态有悬空引用,落完一次性编译。

---

## 0. 数据流总览

```
点击叶子节点 ──selectNode──> catalogueStore.activeNodeId
                                   │
                      catalogueStore.activeLeafId(computed: 叶子→id / 非叶→null)
                                   │  watch
                          useArticleSync ── getArticle(leafId) ──> 后端
                                   │                                 │
                          articleStore.startLoading()        {article:{id,content,createdAt}}
                                   │                                 │
                          (竟态守卫: activeLeafId 仍== leafId) ──> articleStore.setArticle(article)
                                   │
                articleStore.status / articleStore.articleHtml / articleStore.article.createdAt
                                   │
                          ArticlePane 叶子分支(加载中 / 失败重试 / 正文+时间)
```

---

## 1. 新增 `src/api/article.js`(provider,镜像 `api/catalogue.js`)

```js
import axiosInstance from "@/lib/request.js";

/**
 * @typedef {Object} Article 文章对象(获取文章接口的响应)
 * @property {Number} id 文章id(对应目录树中被选中叶子节点的id)
 * @property {String} content 文章正文(md文本)
 * @property {String} createdAt 创建时间,格式: YYYY-MM-DD
 * */

/**
 * 本函数用于请求指定文章正文API
 * @param {Number} id 文章id(即目录树中被选中叶子节点的id)
 * @return {Promise<{article: Article}>} 含文章对象的Promise对象
 * */
function getArticle(id) {
    const uri = '/v1/article/show'
    const param = {
        article: {
            id: id,
        }
    }

    return axiosInstance.post(uri, param)
}

export {
    getArticle,
}
```

---

## 2. 新增 `src/stores/reader/article.js`(文章状态机,裸名)

```js
import {defineStore} from "pinia";
import {computed, ref, shallowRef} from "vue";
import {RequestStatus} from "@/lib/enum.js";
import {renderMarkdownToHtml} from "@/lib/markdown.js";

/**
 * @typedef {import('@/api/article.js').Article} Article
 * */

export const useArticleStore = defineStore('article', () => {
    // PART1. state
    /**
     * @type {import('vue').ShallowRef<Article|null>} 当前选中叶子节点对应的文章对象
     * Tips: 与catalogue同理,文章对象整体替换不逐字段变更,用shallowRef即可
     * */
    const article = shallowRef(null)

    /**
     * @type {import('vue').Ref<String>} 获取文章API的请求状态(初态loading: 叶子分支渲染前watch必先startLoading)
     * */
    const status = ref(RequestStatus.loading)

    /**
     * @type {import('vue').Ref<Number>} 重试信号 该信号自增,以便重新触发useArticleSync中的请求
     * */
    const reloadNonce = ref(0)

    // PART2. computed
    /**
     * @type {import('vue').ComputedRef<String>} 文章正文md对应的安全HTML表达
     * */
    const articleHtml = computed(() => {
        if (article.value === null) {
            return ''
        }

        return renderMarkdownToHtml(article.value.content)
    })

    // mutations/actions
    /**
     * 本函数用于选中叶子节点/重试时调用,清空旧文章并进入loading状态
     * */
    function startLoading() {
        article.value = null
        status.value = RequestStatus.loading
    }

    /**
     * 本函数用于获取文章API请求成功后调用,写入文章对象并标记成功
     * @param {Article} fetchedArticle 后端返回的文章对象
     * */
    function setArticle(fetchedArticle) {
        article.value = fetchedArticle
        status.value = RequestStatus.success
    }

    /**
     * 本函数用于请求获取文章API失败后调用,清空文章并标记失败
     * */
    function markFailed() {
        article.value = null
        status.value = RequestStatus.failed
    }

    /**
     * 本函数用于重试时调用,自增重试信号,触发useArticleSync使用当前叶子id重新请求API
     * */
    function requestReload() {
        reloadNonce.value++
    }

    return {
        // state
        article, status, reloadNonce,

        // computed
        articleHtml,

        // mutations/actions
        startLoading, setArticle, markFailed, requestReload,
    }
})

/**
 * @typedef {ReturnType<typeof useArticleStore>} ArticleStore 文章状态机存储实例
 * */
```

---

## 3. 改 `src/stores/reader/catalogue.js`(加桥 `activeLeafId`、搬走 `articleHtml`)

### 3.1 L2 删 `getLeafContent` 导入

```js
// 改前
import {buildNodeIndex, dfsFindFirstLeafNode, initCollapsedIdSet, getLeafContent} from "@/lib/treeQuery.js";
// 改后
import {buildNodeIndex, dfsFindFirstLeafNode, initCollapsedIdSet} from "@/lib/treeQuery.js";
```

### 3.2 L5 删 `renderMarkdownToHtml` 导入

> `articleHtml` 搬走后,本文件不再用到它,整行删除。

```js
// 改前(删除整行)
import {renderMarkdownToHtml} from "@/lib/markdown.js";
// 改后:无此行
```

### 3.3 新增 `activeLeafId` computed(紧跟 `renderPhase` 之后,L91 后插入)

```js
    /**
     * @type {import('vue').ComputedRef<Number|null>} 当前选中叶子节点的id(供文章store拉取正文用)
     *      - 选中节点为叶子节点: 该叶子节点的id
     *      - 选中节点为非叶节点(或响应未达): null
     * */
    const activeLeafId = computed(() => {
        return renderPhase.value === RenderPhase.leaf ? activeNodeId.value : null
    })
```

### 3.4 删 `articleHtml` computed(原 L124、L143–153)

> PART3 删掉 `articleHtml` 后只剩布局两项,顺手把分区注释收窄。

```js
// 改前(L124 注释 + L143–153 整块)
    // PART3. computed(布局/md文档内容)
    ...
    /**
     * @type {import('vue').ComputedRef<String>} 被选中叶子节点的md文档对应的安全HTML表达
     * */
    const articleHtml = computed(() => {
        if (renderPhase.value === RenderPhase.leaf) {
            const content = getLeafContent(activeNode.value)
            return renderMarkdownToHtml(content)
        }

        return ''
    })
// 改后:整个 articleHtml 块删除;L124 注释改为
    // PART3. computed(布局)
```

### 3.5 return 块:加 `activeLeafId`、去 `articleHtml`(原 L313–322)

```js
// 改前
        // computed: 当前选中节点/状态/节点路径/面包屑导航内容
        activeNode, renderPhase, rootToActivePath, breadcrumb,

        // computed: 布局/md文档内容
        isCatalogueActive, hasMask, articleHtml,
// 改后
        // computed: 当前选中节点/状态/节点路径/面包屑导航内容/激活叶子id
        activeNode, renderPhase, activeLeafId, rootToActivePath, breadcrumb,

        // computed: 布局
        isCatalogueActive, hasMask,
```

---

## 4. 新增 `src/composables/useArticleSync.js`(镜像 `useCatalogueSync`,无 `immediate`)

```js
import {watch} from "vue";
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
import {useArticleStore} from "@/stores/reader/article.js";
import {getArticle} from "@/api/article.js";

/**
 * 本函数用于根据当前选中的叶子节点id,请求该叶子节点对应的文章正文
 *      - 监听目录store的activeLeafId与文章store的reloadNonce,二者任一变化时重新请求API
 *      - activeLeafId为null时(选中非叶节点/响应未达)不请求
 *      - 不使用immediate: 挂载时activeLeafId恒为null,叶子仅在用户点击后出现,普通watch即可捕获
 *      - 本函数在ArticleReader组件中调用1次即可,watch随组件作用域自动回收,不需要手动停止
 * */
export function useArticleSync() {
    const catalogueStore = useCatalogueStore()
    const articleStore = useArticleStore()

    watch(
        [
            () => catalogueStore.activeLeafId,
            () => articleStore.reloadNonce,
        ],
        async (newValues) => {
            const leafId = newValues[0]

            // 选中非叶节点(或响应未达)时,activeLeafId为null,不请求
            if (leafId === null) {
                return
            }

            // 进入loading状态,重新请求API
            articleStore.startLoading()
            try {
                const {article} = await getArticle(leafId)
                // 竟态条件: 在await期间,选中的叶子可能已切换,仅在activeLeafId仍为请求时使用的值时才写入
                if (catalogueStore.activeLeafId === leafId) {
                    articleStore.setArticle(article)
                }
            } catch (err) {
                console.error('请求获取文章API失败', err)
                if (catalogueStore.activeLeafId === leafId) {
                    articleStore.markFailed()
                }
            }
        },
    )
}
```

---

## 5. 改 `src/components/article/ArticlePane.vue`(桥,接第二个 store)

### 5.1 导入(L59 加 `RequestStatus`;L61 后加文章 store 导入)

```js
// 改前
import {RenderPhase} from "@/lib/enum.js";
import SimpleBar from "simplebar";
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
// 改后
import {RenderPhase, RequestStatus} from "@/lib/enum.js";
import SimpleBar from "simplebar";
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
import {useArticleStore} from "@/stores/reader/article.js";
```

### 5.2 新增文章 store 实例(L71 `catalogueStore` 之后)

```js
    /**
     * @type {import('@/stores/reader/article.js').ArticleStore} 文章状态机的实例
     * */
    const articleStore = useArticleStore()
```

> 注:`<script setup>` 顶层无缩进,落地时按文件现有风格顶格写即可(此处缩进仅为文档对齐)。

### 5.3 叶子分支状态化(模板 L4–14)

> 标题 `activeNode.name` 仍取自目录 store(叶子名随树即时可得);**正文与时间**改取文章 store,并按 `articleStore.status` 三态切换。

```vue
// 改前
            <!-- 激活态: 梯形 + 标题 + md文档正文 -->
            <template v-if="catalogueStore.renderPhase === RenderPhase.leaf">
                <h2 class="title">
                    <Trapezoid :height="40" :inset="7"></Trapezoid>
                    <div class="literal">{{catalogueStore.activeNode.name}}</div>
                </h2>

                <div class="article-content markdown-body" v-html="catalogueStore.articleHtml"></div>

                <span class="created-at">{{catalogueStore.activeNode.createdAt}}</span>
            </template>
// 改后
            <!-- 激活态: 梯形 + 标题 + 正文(正文随获取文章API的状态切换) -->
            <template v-if="catalogueStore.renderPhase === RenderPhase.leaf">
                <h2 class="title">
                    <Trapezoid :height="40" :inset="7"></Trapezoid>
                    <div class="literal">{{catalogueStore.activeNode.name}}</div>
                </h2>

                <!-- 加载中 -->
                <div v-if="articleStore.status === RequestStatus.loading" class="article-content article-status">
                    <span>加载中...</span>
                </div>

                <!-- 加载失败: 点击重试 -->
                <div v-else-if="articleStore.status === RequestStatus.failed" class="article-content article-status">
                    <span>加载失败</span>
                    <button type="button" class="retry" @click="articleStore.requestReload()">重试</button>
                </div>

                <!-- 加载成功: 渲染正文 + 创建时间 -->
                <template v-else>
                    <div class="article-content markdown-body" v-html="articleStore.articleHtml"></div>
                    <span class="created-at">{{articleStore.article.createdAt}}</span>
                </template>
            </template>
```

### 5.4 SimpleBar watch 加宽(L140–155)

> 正文由 API **异步**到达,故除 `activeNode`(切叶子/切回非叶时清理 pre/table)外,还要监听 `articleHtml`(正文到达后,才有 pre/table 可挂 SimpleBar)。回调体不变。

```js
// 改前
watch(
    () => catalogueStore.activeNode,
    async () => {
// 改后
watch(
    [
        () => catalogueStore.activeNode,
        () => articleStore.articleHtml,
    ],
    async () => {
```

> 把第一个参数从单 getter 换成 getter 数组即可,回调及其内部 `unmountOverflowScrollbars`/`nextTick`/`recalculate`/`mountOverflowScrollbars` 原样保留。注释里补一句"正文异步到达,故同时监听 articleHtml"。

### 5.5 样式:新增 `.article-status`(加载/失败态占位,镜像 `ArticleReader` 的 retry)

> 加到 `<style scoped>` 内(`.article-content` 规则附近即可)。

```css
/* 文章正文加载态/失败态: 居中占位 */
.article-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    row-gap: 16px;
    /* 占位高度,避免贴顶;具体值可按观感微调 */
    min-height: 240px;
    color: #CFE8FF;
}

.article-status .retry {
    padding: 6px 20px;
    font-size: 16px;
    color: #CFE8FF;
    background: transparent;
    border: 1px solid rgba(32, 198, 216, 0.35);
    border-radius: 8px;
    cursor: pointer;
    transition: 0.2s;
}

.article-status .retry:hover {
    color: #51EEFF;
    border-color: #51EEFF;
}
```

---

## 6. 改 `src/pages/ArticleReader.vue`(挂上文章同步)

### 6.1 导入(L36 之后)

```js
// 改前
import {useCatalogueSync} from "@/composables/useCatalogueSync.js";
// 改后
import {useCatalogueSync} from "@/composables/useCatalogueSync.js";
import {useArticleSync} from "@/composables/useArticleSync.js";
```

### 6.2 调用(L49 `useCatalogueSync()` 之后)

```js
// 改前
// 监听路由中的参数(书籍id),请求该书籍的目录并写入catalogueStore
useCatalogueSync()
// 改后
// 监听路由中的参数(书籍id),请求该书籍的目录并写入catalogueStore
useCatalogueSync()

// 监听选中的叶子节点id,请求该叶子节点对应的文章正文并写入articleStore
useArticleSync()
```

> 本文件无需 import 文章 store——`useArticleSync` 内部已自取两个 store;页级状态门仍是 `catalogueStore.status`,文章三态在 `ArticlePane` 内处理。

---

## 7. 删桩 `src/lib/treeQuery.js`

删掉 `getLeafContent`(原 L155–166)与 `buildSampleMarkdown`(原 L168–204)两个函数,并从导出里去掉 `getLeafContent`。

```js
// 改前(导出块)
export {
    dfsFindNodeWithPath,
    dfsFindFirstLeafNode,
    buildNodeIndex,
    initCollapsedIdSet,
    getLeafContent,
}
// 改后
export {
    dfsFindNodeWithPath,
    dfsFindFirstLeafNode,
    buildNodeIndex,
    initCollapsedIdSet,
}
```

> 保留 `dfsFirstLeaf`(被 `dfsFindFirstLeafNode` 调用)与文件顶部 `CatalogueNodeType` 导入(其余函数仍在用)。

---

## 8. 验证清单

静态:
- [ ] 新增 3 文件存在:`api/article.js`、`stores/reader/article.js`、`composables/useArticleSync.js`
- [ ] `grep -rn "getLeafContent\|buildSampleMarkdown" src/` → **零命中**
- [ ] `grep -rn "catalogueStore.articleHtml" src/` → **零命中**(已改 `articleStore.articleHtml`)
- [ ] `defineStore('article')` 与 `defineStore('catalogue')` 各一,id 不冲突
- [ ] 编译通过,无 "Failed to resolve import" / 无 "is not defined"

运行(重点验异步链路):
- [ ] 点叶子节点:先「加载中...」→ 正文渲染 md、底部显示 `createdAt`
- [ ] 正文里的代码块 / 宽表格:横向滚动条为全局 SimpleBar 皮肤(验证 watch 加宽生效)
- [ ] 叶子 A 切叶子 B:B 重新「加载中」→ 渲染 B;A 的滚动条无残留
- [ ] 叶子切回非叶节点:回到简介分支正常,无报错(pre/table 滚动条已清理)
- [ ] 断网 / 后端 500:叶子分支显示「加载失败 + 重试」;点重试重新请求
- [ ] 请求往返期间快速切到另一叶子:竟态守卫生效,不会用旧响应覆盖新选中

---

## 9. 备注

1. **初态 `status=loading` 的理由**:文章 store 是单例,初态 loading;叶子分支首次渲染前,`useArticleSync` 的 `flush:'pre'` watch 必先跑 `startLoading`,故叶子分支永远先看到 loading,不会用 `article=null` 命中 success 分支(success 分支才读 `article.createdAt`,而 success ⟺ `setArticle` ⟺ `article` 非空,安全)。
2. **`activeLeafId` 为何放目录 store**:它由 `renderPhase`/`activeNodeId` 推导,是**目录侧**派生量;文章 store 只消费它,不持有它。职责清晰。
3. **`ArticlePane` 现在接两个 store**:`catalogueStore`(标题/renderPhase/焦点/按钮)+ `articleStore`(正文三态/articleHtml/createdAt)。这是唯一的桥组件,符合预期。
4. **不对称是有意的**:`useCatalogueSync` 用 `immediate`(路由 id 挂载即在),`useArticleSync` 不用(叶子 id 挂载时为 null)。
5. 全部落完即完成"文章页 store 拆分"两步;后续若要正文缓存,在文章 store 加一层 `Map<leafId, Article>` 即可,不影响现有结构。