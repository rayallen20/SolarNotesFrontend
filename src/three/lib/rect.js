/**
 * 本函数用于计算屏幕坐标系下,给定的点到给定矩形的最近距离(若该点在矩形内,则返回0)
 * @param {DOMRect} rect 给定矩形
 * @param {{x: Number, y: Number}} point 给定点的屏幕坐标
 * @return {Number} 点到矩形的最近距离
 * */
function pointToRectDistancePx(rect, point) {
    let deltaX = 0
    if (point.x < rect.left) {
        deltaX = rect.left - point.x
    }
    if (point.x > rect.right) {
        deltaX = point.x - rect.right
    }

    let deltaY = 0
    if (point.y < rect.top) {
        deltaY = rect.top - point.y
    }
    if (point.y > rect.bottom) {
        deltaY =  point.y - rect.bottom
    }

    return Math.hypot(deltaX, deltaY)
}

/**
 * 本函数用于判断给定的矩形和给定的点是否足够接近,即点到矩形的最近距离是否小于等于某个阈值
 * @param {DOMRect} rect 给定矩形
 * @param {{x: Number, y: Number}} point 给定点的屏幕坐标
 * @param {Number} threshold 距离阈值,单位为像素
 * @return {Boolean} 若点到矩形的最近距离小于阈值,则返回true; 否则返回false
 * */
function isNearRect(rect, point, threshold) {
    return pointToRectDistancePx(rect, point) <= threshold
}

/**
 * 本函数用于判断给定的矩形和给定的点是否足够远离,即点到矩形的最近距离是否大于某个阈值
 * @param {DOMRect} rect 给定矩形
 * @param {{x: Number, y: Number}} point 给定点的屏幕坐标
 * @param {Number} threshold 距离阈值,单位为像素
 * @return {Boolean} 若点到矩形的最近距离大于阈值,则返回true; 否则返回false
 * */
function isFarRect(rect, point, threshold) {
    return pointToRectDistancePx(rect, point) >= threshold
}

export {
    pointToRectDistancePx,
    isNearRect,
    isFarRect,
}