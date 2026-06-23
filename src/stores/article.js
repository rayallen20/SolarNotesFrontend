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
     * @type {import('vue').ShallowRef<CatalogueNode|null>} 当前书籍的目录树根节点
     * Tips: 这里使用shallowRef而非Ref的原因: CatalogueNode响应到达后,不会逐字段变更,只会整体替换,因此使用shallowRef即可
     * */
    const catalogue = shallowRef(null)

    /**
     * @type {import('vue').Ref<String>} 获取目录API的请求状态
     * */
    const status = ref(RequestStatus.loading)

    /**
     * @type {import('vue').Ref<Number>} 重试信号 该信号自增,以便重新触发useCatalogueSync中的请求
     * */
    const reloadNonce = ref(0)

    /**
     * @type {import('vue').Ref<Number|null>} 当前选中节点的id
     *      - 响应未达之前为null
     *      - 响应到达后默认为根节点
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
     * @type {Set<Number>} 本集合用于存储强制展开(跳过动画)的节点id
     * */
    const forceExpandedIds = new Set()

    // PART2. computed(当前选中节点/状态/节点路径/面包屑导航内容)
    /**
     * @type {import('vue').ComputedRef<Map<Number, import('@/lib/treeQuery.js').NodeIndexEntry>>} 树形结构中所有节点的id与节点及其路径的映射关系
     *      - 响应未达之前为空Map
     *      - 响应到达后为id => 路径的映射关系
     * */
    const nodeIndex = computed(() => {
        if (catalogue.value === null) {
            return new Map()
        }

        return buildNodeIndex(catalogue.value)
    })

    /**
     * @type {import('vue').ComputedRef<CatalogueNode|null>} 当前选中节点
     *      - 响应未达之前为null
     *      - 响应到达后为当前选中节点(由于默认选中根节点,所以相应到达后本变量恒不为空)
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
        return activeNode.value.type === CatalogueNodeType.file ? RenderPhase.leaf : RenderPhase.nonLeaf
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
     * 本函数用于进入文章页/重试时调用,清空之前的目录内容并进入loading状态
     * */
    function startLoading() {
        catalogue.value = null
        activeNode.value = null
        status.value = RequestStatus.loading
    }

    /**
     * 本函数用于获取目录API请求成功后调用,写入目录树并复位状态机为浏览态
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
     * 本函数用于请求获取目录API失败后调用,清空目录并标记失败
     * */
    function markFailed() {
        catalogue.value = null
        activeNodeId.value = null
        status.value = RequestStatus.failed
    }

    /**
     * 本函数用于重试时调用,自增重试信号,触发useCatalogueSync使用当前路由中的书籍id重新请求API
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
        const {path} = nodeIndex.get(leaf.id)
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
        catalogue, status, reloadNonce, activeNodeId,
        collapsedIdSet, focusedPane, pendingRevealId,

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