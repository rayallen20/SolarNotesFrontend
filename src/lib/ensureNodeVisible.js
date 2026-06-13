import {prefersReducedMotion} from "@/lib/prefersReducedMotion.js";

/**
 * 本函数用于在目录区容器内将给定的节点滚动进视口
 * @param {HTMLDivElement|null} catalogueElement 目录区容器元素
 * @param {Number|null} targetNodeId 目标节点id
 * @param {{behavior: ScrollBehavior, block: 'center'|'nearest'}} options 滚动选项:
 *      - behavior: 滚动行为,可选值为'auto'或'smooth'
 *      - block: 垂直对齐方式,可选值为'center'/'nearest'
 * */
export function ensureNodeVisible(catalogueElement, targetNodeId, options) {
    if (catalogueElement === null || targetNodeId === null) {
        return
    }

    const {behavior, block} = options
    if (block !== 'center' && block !== 'nearest') {
        return
    }

    const targetLiElement = catalogueElement.querySelector(`.tree-node[data-id="${targetNodeId}"]`)
    if (targetLiElement === null) {
        return
    }

    // 找到SimpleBar的滚动容器
    const scrollElement = catalogueElement.querySelector('.simplebar-content-wrapper')
    if (scrollElement === null) {
        targetLiElement.scrollIntoView({
            behavior,
            block,
            inline: 'nearest',
        })

        return
    }

    // 已在视口内则不处理
    const targetRect = targetLiElement.getBoundingClientRect()
    const wrapRect = scrollElement.getBoundingClientRect()
    if (targetRect.top >= wrapRect.top && targetRect.bottom <= wrapRect.bottom) {
        return
    }

    const currentTop = scrollElement.scrollTop
    let targetTop = currentTop + (targetRect.top - wrapRect.top)

    if (block === 'center') {
        targetTop = targetTop - (wrapRect.height / 2) + (targetRect.height / 2)
    }

    if (block === 'nearest') {
        if (targetRect.top < wrapRect.top) {
            targetTop = currentTop + (targetRect.top - wrapRect.top)
        } else if (targetRect.bottom > wrapRect.bottom) {
            targetTop = currentTop + (targetRect.bottom - wrapRect.bottom)
        }
    }

    scrollElement.scrollTo({
        top: Math.max(0, targetTop),
        behavior: prefersReducedMotion() ? 'auto' : behavior,
    })
}