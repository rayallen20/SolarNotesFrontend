# 目录接口接入 · Part 1 · 异步目录核心

> 本篇是「获取目录接口(`POST /api/v1/catalogue/show`)」接入的第 1 步:把文章页的目录从「同步静态桩 `treeData`」改造成「按书籍 id 异步到达的树」。两个入口(PanelList 书目链接、SolarPanel 的 See More)留到 **Part 2**,待本篇落地确认后再出。
>
> **已确认决策**
> - 状态枚举共享:`BookListStatus` 改名为通用的 `RequestStatus`(`loading/success/failed`),书籍与目录共用。
> - 加载门放在 `ArticleReader`:按 `status` 分支渲染 `加载中 / 加载失败+重试 / 正文`,正文只在 `success` 时挂载 —— 这样内层 `CatalogueTree/HeaderBar/ArticlePane` 永远拿到非空目录,不必逐个补空判。
> - 拉取入口做成 `useCatalogueSync()` composable(与 `useBookListSync` 对称),在 `ArticleReader` 调 1 次;`watch([route.params.id, articleStore.reloadNonce], { immediate:true })` + 竞态守卫。
> - `article` store 改造为异步树:`catalogue` 用 `shallowRef`、节点索引 `nodeIndex` 改为随树派生的 `computed`、初始化挪进 `setCatalogue()`。
> - 路由 `/article` → `/article/:id`(**必填**;所有入口都带 id,详见 §6 与 Part 2 §4)。
> - `CatalogueNode` typedef 移入 `api/catalogue.js`(在请求处标明响应类型),`treeData.js` 及空的 `src/data/` 目录一并删除。
>
> **本篇触及文件**
> - 改:`src/lib/enum.js`、`src/stores/book.js`、`src/components/panel/PanelList.vue`、`src/stores/catalogue.js`、`src/router/index.js`、`src/pages/ArticleReader.vue`、`src/components/article/CatalogueTree.vue`、`src/components/article/TreeNode.vue`、`src/lib/treeQuery.js`
> - 新增:`src/api/catalogue.js`、`src/composables/useCatalogueSync.js`
> - 删:`src/data/treeData.js`(及空目录 `src/data/`)
>
> **落地方式**:按 §1→§9 顺序照抄到 `src/`(已按「先定义后调用」排序);§10 自测;§11 是备注与 Part 2 预告。

---

## §0. 数据流总览

```
进入文章页(route: /article/:id, id = bookId)
        │
        ▼
ArticleReader setup ── useCatalogueSync() 调 1 次
        │   watch([() => route.params.id, () => articleStore.reloadNonce], { immediate:true })
        ▼
articleStore.startLoading()            status=loading, catalogue=null
        │
        ▼
getCatalogue(Number(bookId))   POST /v1/catalogue/show  body { book:{ id } }
        │
   ┌────┴───────────────────┐
   ▼ 成功                    ▼ 失败
setCatalogue(root)          markFailed()
 status=success             status=failed
 catalogue=树根              catalogue=null
   │                         │
   └──────────┬──────────────┘
              ▼
ArticleReader 加载门按 status 分支:
   loading → 「加载中…」
   failed  → 「加载失败」+[重试] → requestReload() → reloadNonce++ → 重新触发 watch
   success → <HeaderBar/> + <ReaderBody/>(CatalogueTree 读 articleStore.catalogue 渲染目录树)
```

竞态守卫:`await` 期间路由可能已切走,回来后只在 `route.params.id` 仍等于当初捕获的 `bookId` 时才写 store(丢弃乱序响应)。

---

## §1. 改 · `src/lib/enum.js`(`BookListStatus` → `RequestStatus`)

把原 `BookListStatus` 这一段(typedef + `const` + 导出项)整体改名为通用的 `RequestStatus`,枚举值不变。

**typedef + 常量**(替换原第 72~82 行那一段):

```js
/**
 * @typedef {Object} RequestStatus 本枚举项用于标识一次异步请求的生命周期状态(书籍列表/目录等读取型请求通用)
 * @property {String} loading 正在请求
 * @property {String} success 请求成功(成功 ≠ 有内容,空响应也算成功)
 * @property {String} failed 请求失败
 * */
const RequestStatus = Object.freeze({
    loading: 'loading',
    success: 'success',
    failed: 'failed',
})
```

**底部导出块**:把 `BookListStatus,` 改成 `RequestStatus,`:

```js
export {
    ActionType,
    HoverPhase,
    FocusPhase,
    CatalogueNodeType,
    RenderPhase,
    FocusedPane,
    RequestStatus,
}
```

> 复用规则(回答「会不会每个 API 一个枚举」):状态集合是 `loading/success/failed` 的读取型请求一律复用 `RequestStatus`,不新增枚举;只有状态机形状真不同(需要 `idle`/把 `empty` 单列/分页 `loadingMore` 等)的请求,才单独定义自己的枚举。

---

## §2. 跟随改名 · `book.js` 与 `PanelList.vue`

改名波及这两个既有引用方(`useBookListSync.js` 只调 store 的 mutation、不直接引用枚举,**无需改**)。

**`src/stores/book.js`**:把本文件内 `BookListStatus` 全部替换为 `RequestStatus`(共 6 处):
- 第 3 行 `import {RequestStatus} from "@/lib/enum.js";`
- 第 21 行 `const status = ref(RequestStatus.success)`
- 第 34 行 `status.value = RequestStatus.loading`
- 第 43 行 `status.value = RequestStatus.success`
- 第 51 行 `status.value = RequestStatus.failed`
- 第 59 行 `status.value = RequestStatus.success`

(第 20 行那句 `API请求状态` 的注释本就是通用措辞,无需改。)

**`src/components/panel/PanelList.vue`**:2 处:
- 第 26 行 `import {RequestStatus} from "@/lib/enum.js";`
- 第 4 行 `<div v-if="bookStore.status === RequestStatus.failed" class="load-error">`

---

## §3. 新建 · `src/api/catalogue.js`(含 `CatalogueNode` 类型定义)

与 `api/book.js` 同构:负责拼请求体、发 POST。另外——按本次商定——把 `CatalogueNode` 的类型定义也落在这里,「在请求处标明响应的类型」。

字段可选性按真实接口契约:`intro / createdAt / children` 仅 `folder` 节点存在(叶子节点只有 `id / type / name`)。路由参数是字符串,故 `Number()` 成整数以贴合接口契约(`book.id` 为 `int`)。

```js
import axiosInstance from "@/lib/request.js";

/**
 * @typedef {Object} CatalogueNode 目录树节点(获取目录接口的响应节点)
 * @property {Number} id 节点唯一id(type为folder时表示章节id;type为file时表示文章id)
 * @property {String} type 节点类型: folder(章节/文件夹) | file(文章/文件)
 * @property {String} name 节点名称
 * @property {String} [intro] 章节简介(仅当type为folder时存在)
 * @property {String} [createdAt] 创建时间,格式YYYY-MM-DD(仅当type为folder时存在)
 * @property {Array<CatalogueNode>} [children] 子节点列表(仅当type为folder时存在)
 * */

/**
 * 本函数用于请求指定书籍的目录树API
 * @param {Number} id 书籍id(由useCatalogueSync从route.params.id转换而来)
 * @return {Promise<{catalogue: CatalogueNode}>} 含目录树根节点的Promise对象
 * */
function getCatalogue(id) {
    const uri = '/v1/catalogue/show'
    const param = {
        book: {
            id: id,
        }
    }

    return axiosInstance.post(uri, param)
}

export {
    getCatalogue,
}
```

---

## §4. 改造 · `src/stores/catalogue.js`(整文件替换)

**相对原文件改了什么(便于你 review)**:
1. `catalogue / status / reloadNonce / activeNodeId / collapsedIdSet` 的初值都改成「空 / 未到货」,真正的初始化挪进 `setCatalogue()`。
2. `nodeIndex` 从「模块级一次性常量」改成 store 内随 `catalogue` 派生的 `computed`(树整体替换时自动重建)。
3. `catalogue` 用 `shallowRef`:目录到货后不再逐字段变更、只被整体替换,浅响应即可;也与改造前的静态 `treeData`「节点皆为普通对象」保持一致(**不**给整棵树套深层响应代理)。
4. `activeNode / renderPhase / breadcrumb` 增加 null 安全(目录未到货时不抛错)。
5. `openArticle()` 用 `catalogue.value` 取代 `treeData`。
6. 新增 `setCatalogue / startLoading / markFailed / requestReload`;不再 `import {treeData}`。

```js
import {defineStore} from "pinia";
import {buildNodeIndex, dfsFindFirstLeafNode, getLeafContent, initCollapsedIdSet} from "@/lib/treeQuery.js";
import {computed, ref, shallowRef} from "vue";
import {CatalogueNodeType, FocusedPane, RenderPhase, RequestStatus} from "@/lib/enum.js";
import {renderMarkdownToHtml} from "@/lib/markdown.js";

/**
 * @typedef {import('@/api/catalogue.js').CatalogueNode} CatalogueNode
 * */

export const useArticleStore = defineStore('article', () => {
    // PART1. state(仅存储不可推导的变量)
    /**
     * @type {import('vue').ShallowRef<CatalogueNode|null>} 当前书籍的目录树根节点(目录未到货时为null)
     * 用shallowRef而非ref: 目录树到货后不再逐字段变更,只会被setCatalogue()整体替换,浅层响应即可;
     *      既避免给整棵树套深层响应代理,也与改造前的静态treeData保持一致(树中节点均为普通对象)
     * */
    const catalogue = shallowRef(null)

    /**
     * @type {import('vue').Ref<String>} 目录API请求状态
     * */
    const status = ref(RequestStatus.loading)

    /**
     * @type {import('vue').Ref<Number>} 重试信号 该信号自增,以便重新触发useCatalogueSync中的请求
     * */
    const reloadNonce = ref(0)

    /**
     * @type {import('vue').Ref<Number|null>} 当前选中节点的id(目录未到货时为null,到货后默认选中根节点)
     * */
    const activeNodeId = ref(null)

    /**
     * @type {import('vue').Ref<Set<Number>>} 被折叠的非叶节点的id集合
     * */
    const collapsedIdSet = ref(new Set())

    /**
     * @type {import('vue').Ref<String>} 当前被聚焦的面板,默认聚焦目录面板(浏览态)
     * */
    const focusedPane = ref(FocusedPane.catalogue)

    /**
     * @type {import('vue').Ref<Number|null>} 待滚入目录面板视口的节点id
     * 由openArticle()函数负责写入;CatalogueTree watch后调用clearPendingReveal()函数清空
     * */
    const pendingRevealId = ref(null)

    /**
     * @type {Set<Number>} 强制展开(跳过动画)的节点id集合(非响应式,仅作渲染期的一次性信号传递)
     * */
    const forceExpandedIds = new Set()

    // PART2. computed(节点索引/当前选中节点/状态/节点路径/面包屑导航内容)
    /**
     * @type {import('vue').ComputedRef<Map<Number, import('@/lib/treeQuery.js').NodeIndexEntry>>}
     *      树中所有节点的id与"节点及其路径"的映射(目录整体替换时自动重建;未到货时为空Map)
     * Tips: 改造前nodeIndex是模块级一次性构建的;现在目录异步到达,故改为随catalogue派生的computed
     * */
    const nodeIndex = computed(() => {
        if (catalogue.value === null) {
            return new Map()
        }

        return buildNodeIndex(catalogue.value)
    })

    /**
     * @type {import('vue').ComputedRef<CatalogueNode|null>} 当前选中节点(目录未到货时为null;到货后因有默认选中节点而恒不为空)
     * */
    const activeNode = computed(() => {
        const entry = nodeIndex.value.get(activeNodeId.value)

        if (entry === undefined) {
            return catalogue.value
        }

        return entry.node
    })

    /**
     * @type {import('vue').ComputedRef<String>} 渲染状态(由当前选中节点是否为叶子节点决定)
     * */
    const renderPhase = computed(() => {
        return activeNode.value?.type === CatalogueNodeType.file ? RenderPhase.leaf : RenderPhase.nonLeaf
    })

    /**
     * @type {import('vue').ComputedRef<Array<CatalogueNode>>} 从根节点开始,到当前选中节点的父节点为止的路径
     * */
    const rootToActivePath = computed(() => {
        const entry = nodeIndex.value.get(activeNodeId.value)
        if (entry === undefined) {
            return []
        }

        return entry.path
    })

    /**
     * @type {import('vue').ComputedRef<String>} 头部面包屑导航中的内容
     * */
    const breadcrumb = computed(() => {
        if (activeNode.value === null) {
            return ''
        }

        const names = []

        for (const node of rootToActivePath.value) {
            names.push(node.name)
        }

        names.push(activeNode.value.name)

        return names.join('/')
    })

    // PART3. computed(布局/md文档内容)
    /**
     * @type {import('vue').ComputedRef<Boolean>} 目录面板是否激活(即浏览态/专注态)
     * */
    const isCatalogueActive = computed(() => {
        return focusedPane.value === FocusedPane.catalogue
    })

    /**
     * @type {import('vue').ComputedRef<Boolean>} 文章区是否覆盖蒙版(专注态时覆盖)
     * Tips: 目录区和文章区的列宽由focusedPane决定,本变量用于:
     *      - 收窄文章区
     *      - 为文章区添加蒙版
     *      - 设置按钮样式
     * */
    const hasMask = computed(() => {
        return renderPhase.value === RenderPhase.leaf && focusedPane.value === FocusedPane.catalogue
    })

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

    // getters
    /**
     * 本函数用于判断给定id的节点当前是否应被折叠
     * @param {Number} id 给定节点的id
     * @return {Boolean} true: 应被折叠; false: 应被展开
     * */
    function isCollapsed(id) {
        return collapsedIdSet.value.has(id)
    }

    // mutations/actions
    /**
     * 本函数用于进入文章页/切换书籍/重试时调用,清空上一本书的目录并进入loading状态
     * */
    function startLoading() {
        catalogue.value = null
        activeNodeId.value = null
        status.value = RequestStatus.loading
    }

    /**
     * 本函数用于目录API请求成功时调用,写入目录树并复位为默认浏览态
     * @param {CatalogueNode} root 后端返回的目录树根节点
     * */
    function setCatalogue(root) {
        catalogue.value = root
        activeNodeId.value = root.id
        collapsedIdSet.value = initCollapsedIdSet(root)
        focusedPane.value = FocusedPane.catalogue
        pendingRevealId.value = null
        forceExpandedIds.clear()
        status.value = RequestStatus.success
    }

    /**
     * 本函数用于目录API请求失败时调用,清空目录并标记失败
     * */
    function markFailed() {
        catalogue.value = null
        activeNodeId.value = null
        status.value = RequestStatus.failed
    }

    /**
     * 本函数用于重试时调用,自增重试信号,触发useCatalogueSync使用当前路由书籍id重新拉取
     * */
    function requestReload() {
        reloadNonce.value++
    }

    /**
     * 本函数用于选中节点时,按节点类型转移焦点:
     *      - 选中节点为叶子节点: 聚焦文章区
     *      - 选中节点为非叶节点: 聚焦目录区
     * @param {Number} id 被选中节点的id
     * */
    function selectNode(id) {
        activeNodeId.value = id

        if (activeNode.value.type === CatalogueNodeType.file) {
            focusedPane.value = FocusedPane.article
            return
        }

        focusedPane.value = FocusedPane.catalogue
    }

    /**
     * 本函数用于切换给定非叶节点的折叠状态
     * @param {Number} id 给定非叶节点的id
     * */
    function toggleCollapsed(id) {
        if (collapsedIdSet.value.has(id)) {
            collapsedIdSet.value.delete(id)
            return
        }

        collapsedIdSet.value.add(id)
    }

    /**
     * 本函数用于展开一组非叶节点
     * @param {Array<Number>} ids 非叶节点id列表
     * */
    function expandFolders(ids) {
        ids.forEach(id => {
            // 已展开的id不触发动画
            if (collapsedIdSet.value.has(id)) {
                collapsedIdSet.value.delete(id)
                forceExpandedIds.add(id)
            }
        })
    }

    /**
     * 本函数用于消费强制展开动画的非叶节点id
     * @param {Number} id 非叶节点id
     * @return {Boolean}
     *      - true: 给定的非叶节点需要强制展开
     *      - false: 给定的非叶节点不需要强制展开
     * */
    function consumeForceExpanded(id) {
        if (forceExpandedIds.has(id)) {
            forceExpandedIds.delete(id)
            return true
        }

        return false
    }

    /**
     * 本函数用于处理开启文章逻辑:
     *      - 找到当前选中的非叶节点子树下的第1个叶子节点(DFS查找)
     *      - 展开该叶子节点的所有祖先节点
     *      - 选中该节点
     *      - 设置需要滚动到视口中的节点id
     * */
    function openArticle() {
        const leaf = dfsFindFirstLeafNode(catalogue.value, activeNodeId.value)
        if (leaf === null) {
            return
        }

        // Tips: leaf必定存在于索引中(因为索引是与树同时构建的),无需判定未命中的情况
        const {path} = nodeIndex.value.get(leaf.id)
        expandFolders(path.map(node => node.id))
        selectNode(leaf.id)
        // 滚动目标 = 叶子节点的父节点
        // Tips: 叶子节点的父节点必然存在,所以不需要判空
        pendingRevealId.value = path[path.length - 1].id
    }

    /**
     * 本函数用于设置焦点到目录区(阅读态切换到专注态;浏览态本身就是聚焦到目录区的,所以调用该函数也是幂等的)
     * */
    function focusCatalogue() {
        focusedPane.value = FocusedPane.catalogue
    }

    /**
     * 本函数用于设置焦点到文章区
     *      - 规则: 聚焦到文章区仅在选中节点为叶子节点时有效,选中节点为非叶节点则直接忽略
     * */
    function focusArticle() {
        if (renderPhase.value !== RenderPhase.leaf) {
            return
        }

        focusedPane.value = FocusedPane.article
    }

    /**
     * 本函数用于清除滚动信号
     * */
    function clearPendingReveal() {
        pendingRevealId.value = null
    }

    return {
        // state
        catalogue, status, reloadNonce, activeNodeId, collapsedIdSet, focusedPane, pendingRevealId,

        // computed: 当前选中节点/状态/节点路径/面包屑导航内容
        activeNode, renderPhase, rootToActivePath, breadcrumb,

        // computed: 布局/md文档内容
        isCatalogueActive, hasMask, articleHtml,

        // getters
        isCollapsed,

        // mutations/actions
        setCatalogue, startLoading, markFailed, requestReload,
        selectNode, toggleCollapsed, expandFolders, consumeForceExpanded,
        openArticle, focusCatalogue, focusArticle, clearPendingReveal,
    }
})

/**
 * @typedef {ReturnType<typeof useArticleStore>} ArticleStore 文章阅读页面状态机存储实例
 * */
```

> `nodeIndex` 没有放进 `return`(它只在 store 内部被 `activeNode/rootToActivePath/openArticle` 用,无外部消费者),保持 store 对外面尽量小。

---

## §5. 新建 · `src/composables/useCatalogueSync.js`

与 `useBookListSync` 对称:监听源 → 拉取 → 写 store,带竞态守卫。差别在于监听源是**路由参数**(`route.params.id`)而非 store,且需要 `{ immediate:true }` 在进入文章页时立刻拉一次。

```js
import {watch} from "vue";
import {useRoute} from "vue-router";
import {useArticleStore} from "@/stores/catalogue.js";
import {getCatalogue} from "@/api/catalogue.js";

/**
 * 本函数用于根据当前路由中的书籍id,请求该书籍的目录树
 *      - 监听路由书籍id(route.params.id)和重试信号(articleStore.reloadNonce)的变化
 *      - id存在时: 请求目录API,并写入articleStore
 *      - 本函数在ArticleReader组件中调用1次即可,watch随组件作用域自动回收,不需要手动停止
 * */
export function useCatalogueSync() {
    const route = useRoute()
    const articleStore = useArticleStore()

    watch(
        [
            () => route.params.id,
            () => articleStore.reloadNonce,
        ],
        async (newValues) => {
            const bookId = newValues[0]

            // 离开文章页时route.params.id会变为undefined(切到无:id的路由),此时不再发请求
            if (!bookId) {
                return
            }

            // 进入文章页/切换书籍/重试: 清空上一本书的目录,进入loading状态,然后再次请求API
            articleStore.startLoading()
            try {
                const {catalogue} = await getCatalogue(Number(bookId))
                // 竞态条件: await期间路由可能已切走,因此仅在路由仍停留在bookId上时,才写入articleStore
                if (route.params.id === bookId) {
                    articleStore.setCatalogue(catalogue)
                }
            } catch (err) {
                console.error('请求目录API失败:', err)
                if (route.params.id === bookId) {
                    articleStore.markFailed()
                }
            }
        },
        {
            immediate: true,
        },
    )
}
```

---

## §6. 改 · `src/router/index.js`(`/article` → `/article/:id`)

把 `article` 路由的 `path` 从 `'/article'` 改成必填参数 `'/article/:id'`:

```js
    {
        path: '/article/:id',
        component: () => import('@/pages/ArticleReader.vue'),
        name: 'article',
    }
```

> **必填 `:id`(已确认的严谨方案)**:文章页必然属于某本书,故 id 必填;所有入口(PanelList 链接、SolarPanel 的 See More)都带 id,配套的「`LuminousAction.to` 改为 link 必传」见 Part 2 §1/§4。
>
> **落地窗口提醒**:在本节落地、Part 2 尚未落地的间隙,`SolarPanel` 还是旧的 See More(写死 `{name:'article'}`、不带 id),在太阳页会报 `vue-router: Missing required param "id"`。把本节与 Part 2 §1、§2 **连着落、落完再统一自测**即可消除该窗口;此间用 PanelList 书目链接测试目录加载。

---

## §7. 改 · `src/pages/ArticleReader.vue`(加载门 + 调 useCatalogueSync)

整文件替换:模板加 `status` 三分支加载门,脚本取 `articleStore` 并调 `useCatalogueSync()`,样式补加载/失败态。

```vue
<template>
    <div class="article-reader">
        <!-- 加载中 -->
        <div v-if="articleStore.status === RequestStatus.loading" class="reader-status">
            <span>加载中…</span>
        </div>

        <!-- 加载失败: 点击重试 -->
        <div v-else-if="articleStore.status === RequestStatus.failed" class="reader-status">
            <span>加载失败</span>
            <button type="button" class="retry" @click="articleStore.requestReload()">重试</button>
        </div>

        <!-- 加载成功: 渲染头部与正文(此时目录树保证存在) -->
        <template v-else>
            <HeaderBar></HeaderBar>
            <ReaderBody></ReaderBody>
        </template>
    </div>
</template>

<script setup>
import HeaderBar from "@/components/article/HeaderBar.vue";
import ReaderBody from "@/components/article/ReaderBody.vue";
import {useArticleStore} from "@/stores/catalogue.js";
import {RequestStatus} from "@/lib/enum.js";
import {useCatalogueSync} from "@/composables/useCatalogueSync.js";
import 'simplebar/dist/simplebar.css';
import '@/assets/scroll/common.css';
import '@/assets/scroll/verticalScroll.css';
import '@/assets/scroll/horizontalScroll.css';
import '@/assets/markdown.css';
import 'highlight.js/styles/atom-one-dark.css';

defineOptions({
    name: 'ArticleReader',
})

/**
 * @type {import('@/stores/catalogue.js').ArticleStore} 文章阅读页面状态机实例
 * */
const articleStore = useArticleStore()

// 监听路由中的书籍id,拉取该书籍的目录树写入articleStore
useCatalogueSync()
</script>

<style scoped>
.article-reader {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: url('@/assets/img/background.jpg') lightgray 50% / cover no-repeat;
}

/* 加载态/失败态: 占满剩余空间并居中 */
.article-reader .reader-status {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    row-gap: 16px;
    color: #CFE8FF;
}

.article-reader .reader-status .retry {
    padding: 6px 20px;
    font-size: 16px;
    color: #CFE8FF;
    background: transparent;
    border: 1px solid rgba(32, 198, 216, 0.35);
    border-radius: 8px;
    cursor: pointer;
    transition: 0.2s;
}

.article-reader .reader-status .retry:hover {
    color: #51EEFF;
    border-color: #51EEFF;
}
</style>
```

> 加载/失败态的视觉与 `PanelList.vue` 的 `.load-error/.retry` 保持一致(同色板),后续要美化两处一起改。

---

## §8. 改 · `src/components/article/CatalogueTree.vue`(根改读 store)

只动 2 处,把根节点来源从静态 `treeData` 换成 `articleStore.catalogue`(此组件只在加载门 `success` 分支下渲染,故 `catalogue` 必非空,无需再判空)。

**模板第 5 行**:

```vue
            <TreeNode :node="articleStore.catalogue" :depth="0"></TreeNode>
```

**脚本**:删掉第 14 行的 `import {treeData} from "@/data/treeData.js";`(`articleStore` 第 15 行已有导入,保留)。

---

## §9. 删 · `src/data/treeData.js`,并把两处 typedef 引用改指 `api/catalogue.js`

`CatalogueNode` 已在 §3 移入 `api/catalogue.js`,`treeData.js` 至此失去存在意义:**整文件删除**;`src/data/` 目录内只有这一个文件,删空后一并删掉。

随之把仍指向旧位置的 typedef 引用改掉(`stores/catalogue.js` 已在 §4 改好、`api/catalogue.js` 是定义处),还剩两处:

**`src/lib/treeQuery.js` 第 4 行**(原是「转引」,改成从新位置 import):

```js
/**
 * @typedef {import('@/api/catalogue.js').CatalogueNode} CatalogueNode
 * */
```

**`src/components/article/TreeNode.vue` 第 69 行**(同样改指 `api/catalogue.js`):

```js
 * @typedef {import('@/api/catalogue.js').CatalogueNode} CatalogueNode 目录树节点
```

---

## §10. 验证清单

- [ ] 太阳页聚焦天体 → 点 `PanelList` 里的某本书 → 地址栏变成 `/article/{bookId}`。
- [ ] 进入文章页先显示「加载中…」,请求成功后出现左栏目录树与头部面包屑。
- [ ] 目录树根节点正确渲染(`CatalogueTree` 读 `articleStore.catalogue` 而非 `treeData`)。
- [ ] 原有交互不回归:折叠/展开、选中节点切换浏览/阅读态、面包屑、See More(指文章页内的「打开文章」`openArticle`)、滚动定位。
- [ ] 断网或后端返回 500 → 显示「加载失败 + 重试」;点「重试」可重新拉取(`reloadNonce` 生效)。
- [ ] 书籍列表那条链路的 loading/失败/重试仍正常(`RequestStatus` 改名未造成回归)。
- [ ] 控制台无真实报错(IDE 对 md/vue 代码块的解析告警可忽略)。
- [ ] 已知过渡现象:Part 2 落地前,`SolarPanel` 的 See More 还没带 id,太阳页会报 `vue-router: Missing required param "id"`;落 Part 2 即消除。

---

## §11. 备注 / Part 2 预告

- **叶子正文不在本篇**:`treeQuery.js` 的 `getLeafContent / buildSampleMarkdown` 属于下一支「文章详情 API」,本篇不动。另:真实接口里 file 节点不含 `createdAt`,`buildSampleMarkdown` 里给叶子拼的 `创建:${node.createdAt}` 会取到 `undefined` —— 它本就是待替换的临时桩,此处不修。
- **`src/data/` 退场**:`CatalogueNode` 类型已随 §3 落在 `api/catalogue.js`,§9 删掉 `treeData.js` 与空目录 `src/data/`,该目录就此退场。
- **Part 2 预告(两个入口)**:
  1. `PanelList` 书目链接:已带 `params:{id: book.id}`,只需在 `:id?` 路由下核对跳转正确(预计无代码改动)。
  2. `SolarPanel` 的 `LuminousAction`(See More):`v-if="bookStore.bookList.length > 0"`(空则隐藏),点击带 `bookStore.bookList[0].id` 跳转。
  3. 给 `LuminousAction` 加 `to` 属性(默认 `{name:'article'}`),让 link 形态能由外部传入带 id 的目标。
  4. 路由:已确认收紧为必填 `/article/:id`,并把 `LuminousAction.to` 改为 link 必传 + 校验(详见 Part 2 §4)。