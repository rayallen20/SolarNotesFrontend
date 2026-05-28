/**
 * 本函数用于定义缓动函数(慢 -> 快 -> 慢)
 * @param {Number} t 进度 (t ∈ [0,1])
 * @return {Number} 缓动后进度 (缓动后进度 ∈ [0,1])
 * */
export function easeInOut(t) {
    if (t < 0.5) {
        return 2 * t * t
    }

    return 1 - Math.pow(-2 * t + 2, 2) / 2
}