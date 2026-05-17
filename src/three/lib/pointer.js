/**
 * 本函数用于根据给定的指针坐标和DOM元素(通常是canvas),计算指针在该DOM元素中的归一化设备(NDC)坐标
 * @param {Number} clientX 鼠标的客户端X坐标 (相对于视口左上角)
 * @param {Number} clientY 鼠标的客户端Y坐标 (相对于视口左上角)
 * @param {HTMLElement} domElement 渲染场景的DOM元素 (通常是canvas)
 * @param {import('three').Vector2} out 输出的NDC坐标对象
 * */
function getNDCCoordinate(clientX, clientY, domElement, out) {
    const rect = domElement.getBoundingClientRect()

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1

    out.set(ndcX, ndcY)
}

/**
 * 本函数用于将NDC坐标设置为一个有效范围([-1, 1])之外的哨兵值,该哨兵值是无效的
 * @param {import('three').Vector2} out 待设置的NDC坐标对象
 * */
function setLeaveCoordinate(out) {
    out.set(9999, 9999)
}

export {
    getNDCCoordinate,
    setLeaveCoordinate,
}