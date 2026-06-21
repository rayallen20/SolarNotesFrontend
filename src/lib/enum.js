/**
 * @typedef {Object} ActionType 本枚举项用于标识LuminousAction组件中渲染内容
 * @property {String} button - 标识渲染按钮标签
 * @property {String} link - 标识渲染链接标签
 * */
const ActionType = Object.freeze({
    button: 'button',
    link: 'link',
})

/**
 * @typedef {Object} HoverPhase 本枚举项用于标识当前悬停状态
 * @property {String} idle - 没有悬停任何物体
 * @property {String} body - 悬停在某个天体上
 * @property {String} sticky - 悬停在粘滞区上
 * @property {String} label - 悬停在label上
 * */
const HoverPhase = Object.freeze({
    idle: 'idle',
    body: 'body',
    sticky: 'sticky',
    label: 'label',
})

/**
 * @typedef {Object} FocusPhase 本枚举项用于表示当前聚焦状态
 * @property {String} idle - 未聚焦任何天体
 * @property {String} focusing - 正在播放"聚焦到某个天体"的相机动画
 * @property {String} focused - 已经聚焦到某个天体上,此时:
 *      - 动画结束
 *      - OrbitControls已重新启用
 *      - panel已显示
 * @property {String} clearing - 正在播放"从某个天体退出聚焦"的相机动画
 * */
const FocusPhase = Object.freeze({
    idle: 'idle',
    focusing: 'focusing',
    focused: 'focused',
    clearing: 'clearing',
})

/**
 * @typedef {Object} CatalogueNodeType 本枚举项用于标识目录树节点的类型
 * @property {String} folder 标识节点类型为文件夹(可含子节点)
 * @property {String} file 标识节点类型为文件(叶子节点)
 * */
const CatalogueNodeType = Object.freeze({
    folder: 'folder',
    file: 'file',
})

/**
 * @typedef {Object} RenderPhase 本枚举项用于标识文章区当前的渲染状态(由选中节点是否为叶子节点决定)
 * @property {String} leaf 渲染叶子节点(文件): 展示md文档正文(激活态)
 * @property {String} nonLeaf 渲染非叶节点(文件夹) 或 初始状态(未选中任何节点的状态,此时展示根节点简介) (非激活态)
 * */
const RenderPhase = Object.freeze({
    leaf: 'leaf',
    nonLeaf: 'nonLeaf',
})

/**
 * @typedef {Object} FocusedPane 本枚举项用于标识文章页当前被聚焦(占宽70%)的面板
 * @property {String} catalogue 聚焦目录树面板(浏览态/专注态)
 * @property {String} article 聚焦文章面板(阅读态)
 * */
const FocusedPane = Object.freeze({
    catalogue: 'catalogue',
    article: 'article',
})

/**
 * @typedef {Object} BookListStatus 本枚举项用于标识获取书籍列表API的请求状态
 * @property {String} loading 正在请求
 * @property {String} success 请求成功(但列表可能为空,表示该天体下暂无书籍)
 * @property {String} failed 请求失败
 * */
const BookListStatus = Object.freeze({
    loading: 'loading',
    success: 'success',
    failed: 'failed',
})

export {
    ActionType,
    HoverPhase,
    FocusPhase,
    CatalogueNodeType,
    RenderPhase,
    FocusedPane,
    BookListStatus,
}