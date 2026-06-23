# 文章接口接入 · 叶子节点正文

> 本篇接入「获取文章接口」(POST `/v1/article/show`,body `{article:{id}}`,响应 `data.article = {id, content, createdAt}`)。触发点:在目录区点击**叶子节点(文章)**时,按其 id 请求正文并渲染到文章区;叶子节点的 `createdAt` 也由本接口提供(目录接口的叶子节点只有 `id/type/name`)。本接口**替换掉** `treeQuery.js` 里 `getLeafContent`/`buildSampleMarkdown` 那段临时桩。
>
> **结构同前**:仍是「异步内容同步进 store + loading/success/failed + 竞态守卫」,与目录接口同构;只是触发源从"路由参数"换成了"当前选中的叶子节点 id"。
>
> **决策点(可 redline)**
> 1. **不做正文缓存**:每次打开叶子都重新请求(与目录接口一致、YAGNI)。日后要"已读秒切"再加 `Map<id, Article>` 缓存。
> 2. **文章状态与目录状态解耦**:切书(目录重载)不重置文章状态;残留的上一篇在浏览态下不展示,下次打开任意叶子时由 `startLoadingArticle` 清空。
> 3. **命名对称化(已定)**:目录侧「请求生命周期」成员一并加 `Catalogue` 后缀(`catalogueStatus`/`catalogueReloadNonce`/`startLoadingCatalogue`/`markCatalogueFailed`/`requestCatalogueReload`),与文章侧对称;`setCatalogue`/`catalogue` 本就带名词不动。改动见 §2.3 / §3.2 / §4.1。(`bookStore` 同名成员不在范围,勿误改。)
> 4. **`useArticleSync` 不用 `immediate`**:与 `useCatalogueSync` 不同——挂载时 `activeLeafId` 为 null,首次选中叶子本身就是一次 change 会触发 watch,无需 immediate(详见 §8)。
> 5. **`ArticlePane` 的滚动条 watch 拓宽**为 `[activeNode, articleHtml]`:正文异步到达,否则宽表格/宽代码块的横向滚动条挂不上(详见 §5、§8)。
>
> **本篇触及文件**
> - 新增:`src/api/catalogue.js`、`src/composables/useArticleSync.js`
> - 改:`src/stores/catalogue.js`、`src/composables/useCatalogueSync.js`、`src/pages/ArticleReader.vue`、`src/components/article/ArticlePane.vue`
> - 删桩:`src/lib/treeQuery.js`(`getLeafContent`/`buildSampleMarkdown`)
>
> **落地顺序**:§1→§6 顺序照抄(api → store → composables → ArticleReader → ArticlePane → 删桩);§7 自测。**目录侧改名(§2.3 + §3.2 + §4.1)三处要连着落**,中间态会因旧名已删、新名未接而报错。

---

## §0. 数据流总览

```
目录区点击叶子节点
        │ selectNode(leafId)  → activeNodeId = leafId, focusedPane = article
        ▼
store.activeLeafId  (computed: renderPhase===leaf ? activeNodeId : null)
        │ 变化
        ▼
useArticleSync  (watch activeLeafId / articleReloadNonce)
        │ leafId 非 null
        ├── startLoadingArticle()         → articleStatus = loading, article = null
        ├── getArticle(leafId)             → POST /v1/article/show {article:{id}}
        │       成功 + 竞态校验通过 → setArticle(article)   → articleStatus = success
        │       失败 + 竞态校验通过 → markArticleFailed()   → articleStatus = failed
        ▼
ArticlePane(叶子分支)按 articleStatus 切换:
        loading → "加载中..."
        failed  → "加载失败 + 重试"(@click requestArticleReload → articleReloadNonce++ → 回到 watch)
        success → v-html articleHtml(由 article.content 渲染) + article.createdAt
```

非叶节点(文件夹/初始浏览态):`activeLeafId` 为 null,**不**触发本接口;文章区照旧显示该节点的 `name`/`intro`/`createdAt`(均来自目录接口)。

---

## §1. 新增 · `src/api/catalogue.js`

与 `api/catalogue.js` 同构:在请求处用 typedef 标明响应类型。`getArticle` 经响应拦截器解包后直接 resolve 出 `data`(即 `{article: {...}}`)。

```js
import axiosInstance from "@/lib/request.js";

/**
 * @typedef {Object} Article 文章对象(获取文章接口的响应)
 * @property {Number} id 文章id(对应目录树中被选中叶子节点的id)
 * @property {String} content 文章正文(md文本)
 * @property {String} createdAt 文章创建时间,格式: YYYY-MM-DD
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

## §2. 改造 · `src/stores/catalogue.js`

文章正文从"由节点同步推导(桩)"变为"异步请求到达",因此需要新增一组文章请求状态,并把 `articleHtml` 改为从 `article.content` 渲染。

### 2.1 改 import(去掉 `getLeafContent`)

```js
// 改前
import {buildNodeIndex, dfsFindFirstLeafNode, getLeafContent, initCollapsedIdSet} from "@/lib/treeQuery.js";
// 改后
import {buildNodeIndex, dfsFindFirstLeafNode, initCollapsedIdSet} from "@/lib/treeQuery.js";
```

### 2.2 加 `Article` typedef(紧跟现有 `CatalogueNode` typedef 之后)

```js
/**
 * @typedef {import('@/api/catalogue.js').CatalogueNode} CatalogueNode
 * */

/**
 * @typedef {import('@/api/catalogue.js').Article} Article
 * */
```

### 2.3 目录侧请求状态/动作改名(对称化)

把目录侧「请求生命周期」的 5 个成员加 `Catalogue` 限定,与文章侧对称(`setCatalogue`/`catalogue` 本就带名词、不动)。**函数体内对 `status.value`/`reloadNonce.value` 的引用一并改。**

> ⚠️ **三处一起落**:本小步(store)+ §3.2(useCatalogueSync)+ §4.1(ArticleReader 模板)是同一次改名的三个落点,要连着落——中间态下旧名已删、新名未接,`useCatalogueSync` 会因找不到 `startLoading`/`markFailed` 而报错。

**state 定义处**(`status`、`reloadNonce` 改名):

```js
// 改前
const status = ref(RequestStatus.loading)
const reloadNonce = ref(0)
// 改后
const catalogueStatus = ref(RequestStatus.loading)
const catalogueReloadNonce = ref(0)
```

**mutation 定义处**(`startLoading`/`markFailed`/`requestReload` 改名 + 内部引用一并改;`setCatalogue` 函数名不变,只改内部 `status.value`):

```js
// 改前
function startLoading() {
    catalogue.value = null
    activeNode.value = null
    status.value = RequestStatus.loading
}
// 改后(顺手修了一处 bug,见下方 🐛)
function startLoadingCatalogue() {
    catalogue.value = null
    activeNodeId.value = null
    catalogueStatus.value = RequestStatus.loading
}
```

```js
// setCatalogue: 函数名不变,只把内部这一行的 status 改名
// 改前
status.value = RequestStatus.success
// 改后
catalogueStatus.value = RequestStatus.success
```

```js
// 改前
function markFailed() {
    catalogue.value = null
    activeNodeId.value = null
    status.value = RequestStatus.failed
}
// 改后
function markCatalogueFailed() {
    catalogue.value = null
    activeNodeId.value = null
    catalogueStatus.value = RequestStatus.failed
}
```

```js
// 改前
function requestReload() {
    reloadNonce.value++
}
// 改后
function requestCatalogueReload() {
    catalogueReloadNonce.value++
}
```

> 🐛 **顺手发现的 bug**:`startLoading` 原本第二行是 `activeNode.value = null`,但 `activeNode` 是只读 computed(本文件已有定义),给只读 computed 赋值在 dev 下会报 `Write operation failed: computed value is readonly`,且每次进文章页/重试都触发一次告警。对照 `markFailed` 用的是 `activeNodeId.value = null`,可知此处本意也是 `activeNodeId`。上面「改后」已把这行一并修正为 `activeNodeId.value = null`——`catalogue` 置空后 `activeNode`(computed)本就自然返回 null,所以这只是**消除告警、行为不变**。若不想在改名步里夹带修 bug,保留原 `activeNode.value` 也行,但既然正动这个函数,建议一并修掉。

### 2.4 加文章请求状态(PART1 state 末尾,`forceExpandedIds` 之后插入)

```js
    /**
     * @type {import('vue').ShallowRef<Article|null>} 当前选中叶子节点对应的文章对象
     *      - 浏览态(选中非叶节点)/正文请求未达之前为null
     *      - 正文请求成功后为后端返回的文章对象
     * Tips: 与catalogue同理,文章对象整体替换、不逐字段变更,故使用shallowRef即可
     * */
    const article = shallowRef(null)

    /**
     * @type {import('vue').Ref<String>} 获取文章接口的请求状态
     * */
    const articleStatus = ref(RequestStatus.loading)

    /**
     * @type {import('vue').Ref<Number>} 文章正文重试信号 该信号自增,以便重新触发useArticleSync中的请求
     * */
    const articleReloadNonce = ref(0)
```

### 2.5 加 `activeLeafId` computed(紧跟现有 `renderPhase` 之后插入)

`useArticleSync` 监听它:选中叶子时为该叶子的 id、选中非叶时为 null。把"是不是叶子"的判断收在 store 里,composable 就能像 `useCatalogueSync` 那样只做一句 `if (leafId === null) return`。

```js
    /**
     * @type {import('vue').ComputedRef<Number|null>} 当前选中叶子节点的id(供useArticleSync监听)
     *      - 选中节点为叶子节点(渲染态为leaf): 该叶子节点的id
     *      - 选中节点为非叶节点(浏览态): null(此时不需要请求文章正文)
     * */
    const activeLeafId = computed(() => {
        return renderPhase.value === RenderPhase.leaf ? activeNodeId.value : null
    })
```

### 2.6 改 `articleHtml` computed(改为从 `article.content` 渲染)

```js
    /**
     * @type {import('vue').ComputedRef<String>} 当前文章正文对应的安全HTML表达
     *      - 文章对象为空(浏览态/请求未达)时为空串
     *      - 文章对象到达后为其content字段渲染出的安全HTML
     * */
    const articleHtml = computed(() => {
        if (article.value === null) {
            return ''
        }

        return renderMarkdownToHtml(article.value.content)
    })
```

### 2.7 加文章请求 mutations(紧跟现有 `requestCatalogueReload` 之后插入)

与目录的 `startLoadingCatalogue`/`setCatalogue`/`markCatalogueFailed`/`requestCatalogueReload` 一一对应。

```js
    /**
     * 本函数用于选中叶子节点/重试时调用,清空上一篇正文并进入loading状态
     * */
    function startLoadingArticle() {
        article.value = null
        articleStatus.value = RequestStatus.loading
    }

    /**
     * 本函数用于获取文章接口请求成功后调用,写入文章对象
     * @param {Article} fetchedArticle 后端返回的文章对象
     * */
    function setArticle(fetchedArticle) {
        article.value = fetchedArticle
        articleStatus.value = RequestStatus.success
    }

    /**
     * 本函数用于获取文章接口请求失败后调用,清空正文并标记失败
     * */
    function markArticleFailed() {
        article.value = null
        articleStatus.value = RequestStatus.failed
    }

    /**
     * 本函数用于文章正文重试时调用,自增重试信号,触发useArticleSync使用当前叶子节点id重新请求API
     * */
    function requestArticleReload() {
        articleReloadNonce.value++
    }
```

### 2.8 改 return(导出新增项)

```js
    return {
        // state
        catalogue, catalogueStatus, catalogueReloadNonce, activeNodeId,
        collapsedIdSet, focusedPane, pendingRevealId,
        article, articleStatus, articleReloadNonce,

        // computed: 当前选中节点/状态/节点路径/面包屑导航内容
        activeNode, renderPhase, activeLeafId, rootToActivePath, breadcrumb,

        // computed: 布局/md文档内容
        isCatalogueActive, hasMask, articleHtml,

        // getters
        isCollapsed,

        // mutations/actions
        setCatalogue, startLoadingCatalogue, markCatalogueFailed, requestCatalogueReload,
        startLoadingArticle, setArticle, markArticleFailed, requestArticleReload,
        selectNode, toggleCollapsed, expandFolders, consumeForceExpanded,
        openArticle, focusCatalogue, focusArticle, clearPendingReveal,
    }
```

---

## §3. 改 composables

### 3.1 新增 · `src/composables/useArticleSync.js`

`useCatalogueSync` 的同构体:把"监听路由 id"换成"监听 `activeLeafId`",其余(loading→请求→竞态校验→写回)一致。注意它只依赖 store,不需要 `useRoute`。

```js
import {watch} from "vue";
import {useArticleStore} from "@/stores/catalogue.js";
import {getArticle} from "@/api/catalogue.js";

/**
 * 本函数用于根据当前选中的叶子节点id,请求该叶子节点对应的文章正文
 *      - 本函数监听存储中当前叶子节点id(activeLeafId)和文章重试信号(articleReloadNonce)的变化,当二者中任意一个发生变化时将重新请求API
 *      - activeLeafId为null时(选中非叶节点/浏览态): 不请求
 *      - activeLeafId非null时: 请求获取文章API,并写入articleStore
 *      - 本函数在ArticleReader组件中调用1次即可,watch随组件作用域自动回收,不需要手动停止
 * */
export function useArticleSync() {
    const articleStore = useArticleStore()

    watch(
        [
            () => articleStore.activeLeafId,
            () => articleStore.articleReloadNonce,
        ],
        async (newValues) => {
            const leafId = newValues[0]

            // 选中非叶节点(浏览态)时,activeLeafId为null,此时不需要请求文章正文
            if (leafId === null) {
                return
            }

            // 进入loading状态,请求文章正文
            articleStore.startLoadingArticle()
            try {
                const {article} = await getArticle(leafId)
                // 竞态条件: 在await期间用户可能已切换选中节点,因此仅在当前叶子节点id仍为请求时使用的值时,才写入articleStore
                if (articleStore.activeLeafId === leafId) {
                    articleStore.setArticle(article)
                }
            } catch (err) {
                console.error('请求获取文章API失败', err)
                if (articleStore.activeLeafId === leafId) {
                    articleStore.markArticleFailed()
                }
            }
        },
    )
}
```

### 3.2 改 · `src/composables/useCatalogueSync.js`(跟随目录侧改名)

四处引用跟着 §2.3 改名(`setCatalogue` 不变):

- **L19 watch 源**:`() => articleStore.reloadNonce,` → `() => articleStore.catalogueReloadNonce,`
- **L30**:`articleStore.startLoading()` → `articleStore.startLoadingCatalogue()`
- **L40**:`articleStore.markFailed()` → `articleStore.markCatalogueFailed()`
- **L8 注释**:把文中 `articleStore.reloadNonce` 改为 `articleStore.catalogueReloadNonce`
- **L35**:`articleStore.setCatalogue(catalogue)` **不变**

---

## §4. 改 · `src/pages/ArticleReader.vue`

两件事:先跟随目录侧改名(模板里的 `status`/`requestReload`),再挂上文章同步。

### 4.1 跟随改名(模板)

模板里目录侧的请求状态/重试引用跟着 §2.3 改名:

- **L4 / L9 / L14**:三处 `articleStore.status` → `articleStore.catalogueStatus`(分别是 loading / failed / success 分支的判断)
- **L11**:`@click="articleStore.requestReload()"` → `@click="articleStore.requestCatalogueReload()"`

### 4.2 挂上文章同步

**脚本**:加 import(紧跟现有 `useCatalogueSync` 的 import 之后):

```js
import {useArticleSync} from "@/composables/useArticleSync.js";
```

调用处(现有 `useCatalogueSync()` 之后):

```js
// 监听路由中的参数(书籍id),请求该书籍的目录并写入articleStore
useCatalogueSync()

// 监听选中的叶子节点,请求该叶子节点对应的文章正文并写入articleStore
useArticleSync()
```

---

## §5. 改 · `src/components/article/ArticlePane.vue`

三处改动:叶子分支按 `articleStatus` 切换、`createdAt` 改取自文章对象、滚动条 watch 拓宽。

### 5.1 模板:叶子(激活态)分支按请求状态切换

把现有叶子分支(`<template v-if="articleStore.renderPhase === RenderPhase.leaf">` 整段)替换为:

```vue
            <!-- 激活态: 梯形 + 标题 + md文档正文 -->
            <template v-if="articleStore.renderPhase === RenderPhase.leaf">
                <h2 class="title">
                    <Trapezoid :height="40" :inset="7"></Trapezoid>
                    <div class="literal">{{articleStore.activeNode.name}}</div>
                </h2>

                <!-- 正文加载中 -->
                <div v-if="articleStore.articleStatus === RequestStatus.loading" class="article-content article-status">
                    <span>加载中...</span>
                </div>

                <!-- 正文加载失败: 点击重试 -->
                <div v-else-if="articleStore.articleStatus === RequestStatus.failed" class="article-content article-status">
                    <span>加载失败</span>
                    <button type="button" class="retry" @click="articleStore.requestArticleReload()">重试</button>
                </div>

                <!-- 正文加载成功: md文档正文 + 创建时间 -->
                <template v-else>
                    <div class="article-content markdown-body" v-html="articleStore.articleHtml"></div>
                    <span class="created-at">{{articleStore.article.createdAt}}</span>
                </template>
            </template>
```

> 标题(`activeNode.name`)恒来自目录节点、同步可得,故始终先显示;只有正文与创建时间随请求状态切换。success 分支里 `article` 必非空(`setArticle` 同步置 `article` 与 `articleStatus=success`,二者不会出现"状态已 success 但对象还为 null"的缝隙),故 `articleStore.article.createdAt` 无需 `?.`。
>
> 非叶分支(`<template v-else>` 那段:显示 `name`/`intro`/`createdAt`)**不动**——文件夹的 `createdAt` 来自目录接口,本就有值。

### 5.2 脚本:引入 `RequestStatus`

```js
// 改前
import {RenderPhase} from "@/lib/enum.js";
// 改后
import {RenderPhase, RequestStatus} from "@/lib/enum.js";
```

### 5.3 脚本:滚动条 watch 拓宽为 `[activeNode, articleHtml]`

正文现在异步到达:`activeNode` 先变(此刻正文还是"加载中"、DOM 里没有 `.markdown-body`),`articleHtml` 稍后才填充。只听 `activeNode` 会导致正文到达时漏挂 pre/table 的横向滚动条。把监听源改为数组,同时覆盖两个时机(卸载/挂载本身幂等,加载态无 pre/table 时为空操作,安全)。

把现有 `watch(() => articleStore.activeNode, async () => {...})` 改为:

```js
// Tips: 从store中读到的Proxy对象会自动解包,因此在组件中拿到的就是一个普通对象,无法被watch
// Tips: 因此要使用getter()函数的形式,才能被watch()函数监听
// Tips: 文章正文异步到达(activeNode先变、articleHtml稍后才填充),故同时监听二者:
//      - activeNode: 覆盖非叶→非叶/进入叶子等容器内容变化,触发主滚动条recalculate
//      - articleHtml: 覆盖正文异步到达,触发pre/table横向滚动条的重新挂载
watch([() => articleStore.activeNode, () => articleStore.articleHtml], async () => {
    // Tips: watch默认flush:'pre',跑在DOM更新之前,此刻旧元素仍在DOM中,可干净卸载
    unmountOverflowScrollbars()

    await nextTick()

    if (scrollbar !== null) {
        scrollbar.recalculate()
    }

    // DOM已更新为新的md文档对应的HTML,为新的pre/table元素挂载SimpleBar
    mountOverflowScrollbars()
})
```

### 5.4 样式:加载/失败占位区(`<style scoped>` 末尾追加)

复用 `ArticleReader` 失败态的视觉(青色描边重试按钮)。`.article-status` 同时挂了 `.article-content`,因此继承其左右内边距。

```css
/* 正文加载中/加载失败的占位区 */
.article-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    row-gap: 16px;
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

## §6. 删桩 · `src/lib/treeQuery.js`

正文已由 `getArticle` 提供,删除临时桩:

1. 删除 `getLeafContent` 函数整段。
2. 删除 `buildSampleMarkdown` 函数整段。
3. 从导出里去掉 `getLeafContent`:

```js
// 改后(导出块)
export {
    dfsFindNodeWithPath,
    dfsFindFirstLeafNode,
    buildNodeIndex,
    initCollapsedIdSet,
}
```

> 顶部 `import {CatalogueNodeType} from "@/lib/enum.js";` 仍被其余函数(`dfsFindNodeWithPath` 等)使用,保留。删桩后 `treeQuery.js` 不再引用 `node.content`/`node.createdAt`,与"叶子节点只有 id/type/name"的契约对齐。

---

## §7. 验证清单

- [ ] 进入某书目录 → 点一个叶子节点(文章):文章区先显示"加载中...",正文到达后渲染 md(标题来自目录节点、正文/创建时间来自文章接口)。
- [ ] 叶子节点的创建时间(`createdAt`)正确显示——来自文章接口而非目录节点(过去这里是空的)。
- [ ] 切换不同叶子 → 正文跟着切换;**快速连点**不同叶子(竞态)→ 最终显示的是最后选中节点的正文,不串台。
- [ ] 断网 / 后端非 200 → 文章区显示"加载失败 + 重试";点重试 → 重新请求并渲染。
- [ ] 正文含宽表格 / 宽代码块 → 横向滚动条(SimpleBar)正常,**异步到达后也能挂上**(不只是首屏)。
- [ ] 选中非叶节点(文件夹)→ 显示其简介 + 创建时间(来自目录接口),**不**发文章接口请求。
- [ ] 专注 / 恢复(开启文章 / 专注目录)切换后,正文滚动条仍生效。
- [ ] 控制台无报错;Network 面板确认:点叶子才发 `/v1/article/show`,点文件夹不发。
- [ ] (改名回归)目录加载失败 → 点重试仍能重新拉目录;PanelList 书目 / See More 进入文章页仍正常(`catalogueStatus`/`requestCatalogueReload` 已接通)。
- [ ] (改名回归)`startLoadingCatalogue` 运行时控制台**不再**出现 `Write operation failed: computed value is readonly`(原 `startLoading` 误写 `activeNode.value` 的告警已随 §2.3 修复消失)。

---

## §8. 备注(决策与边界)

1. **不做正文缓存**:每次打开叶子都重新请求(与目录接口一致、YAGNI)。日后若要"已读叶子秒切",再加 `Map<id, Article>` 缓存层并处理失效。
2. **文章状态与目录状态解耦**:切书(目录重载,`startLoadingCatalogue`/`setCatalogue`)**不**重置 `article`/`articleStatus`。残留的上一篇正文在浏览态下不展示,下次打开任意叶子时由 `startLoadingArticle` 清空。两个状态机各管各的生命周期,不互相耦合。
3. **命名对称化(已定)**:目录侧与文章侧的「请求生命周期」成员同形——`catalogue`/`article`、`catalogueStatus`/`articleStatus`、`catalogueReloadNonce`/`articleReloadNonce`、`startLoadingCatalogue`/`startLoadingArticle`、`setCatalogue`/`setArticle`、`markCatalogueFailed`/`markArticleFailed`、`requestCatalogueReload`/`requestArticleReload`。`bookStore` 虽有同名成员(`status`/`reloadNonce`/…),但它只有一条请求生命周期、裸名即可,**不在改名范围、勿误改**。`activeNodeId`/`collapsedIdSet`/`focusedPane` 等为树/页面级共享状态,非某条请求所有,保持裸名。
4. **`useArticleSync` 不用 `immediate`**:`useCatalogueSync` 需要 `immediate` 是因为挂载时路由 `id` 已存在、要立刻拉首屏目录;而 `activeLeafId` 在挂载时为 null(目录尚未加载、且加载后默认选中根节点这一非叶节点),首次选中叶子本身就是一次 change,会触发 watch,故 `immediate` 是多余的空转,省去。
5. **`ArticlePane` 滚动条 watch 拓宽的原因**见 §5.3:正文异步化后,`activeNode` 变化时正文 DOM 尚未就绪,必须把 `articleHtml` 也纳入监听,否则宽表格/宽代码块的横向滚动条在正文到达时挂不上。
6. **空正文边界**:若后端返回 `content` 为空串,`renderMarkdownToHtml('')` 得空串,正文区为空——可接受,不另作处理。