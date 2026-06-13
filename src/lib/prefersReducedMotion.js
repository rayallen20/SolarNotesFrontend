/**
 * 本函数用于检测客户端视口开启减少动态效果偏好
 * @return {Boolean}
 *      - true: 开启减少动态效果偏好
 *      - false: 未开启减少动态效果偏好
 * */
export function prefersReducedMotion() {
    if (window.matchMedia) {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    return false
}
