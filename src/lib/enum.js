/**
 * @typedef {Object} ActionType 本枚举项用于标识LuminousAction组件中渲染内容
 * @property {string} button - 标识渲染按钮标签
 * @property {string} link - 标识渲染链接标签
 * */
const ActionType = Object.freeze({
    button: 'button',
    link: 'link',
})

/**
 * @typedef {Object} HoverPhase 本枚举项用于标识当前悬停状态
 * @property {string} idle - 没有悬停任何物体
 * @property {string} body - 悬停在某个天体上
 * @property {string} sticky - 悬停在粘滞区上
 * @property {string} label - 悬停在label上
 * */
const HoverPhase = Object.freeze({
    idle: 'idle',
    body: 'body',
    sticky: 'sticky',
    label: 'label',
})

export {
    ActionType,
    HoverPhase,
}