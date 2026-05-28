import * as THREE from 'three'

/**
 * @typedef {Object} LocalBoundingSphere 物体本地坐标系下的包围球
 * @property {import('three').Vector3} centerLocal 本地坐标系下的球心
 * @property {number} radiusLocal 本地坐标系下的半径
 */

/**
 * @typedef {Object} ScreenProjection 物体在屏幕上的投影信息
 * @property {{x: number, y: number}} centerPx 屏幕像素坐标系下的中心点
 * @property {number} radiusPx 屏幕像素下的半径
 * @property {number} ndcZ 投影中心的NDC坐标在z轴上的分量(ndcZ > 1 表示物体在镜头后方)
 */

/**
 * @type {import('three').Vector3} 本常量用于表示包围球的中心点世界坐标
 * */
const centerWorld = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 本常量用于表示包围球中心点的NDC坐标
 * Tips: 这里的NDC坐标有3个分量,是因为需要使用z轴坐标判定包围球在相机前方(z < 0)还是在相机后方(z > 0)
 * */
const centerNDC = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 本变量用于表示在世界坐标系下,从包围球的球心出发,
 * 沿着相机右方向延伸1个包围球半径长度后,所在的点的世界坐标
 * */
const cameraRightSampleWorld = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 本常量用于表示在世界坐标系下,从包围球的球心出发,
 * 沿着相机右方向延伸1个包围球半径长度后,所在的点的NDC坐标
 * */
const cameraRightSampleNDC = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 本常量用于表示在世界坐标系下,相机右方向的单位向量
 * */
const cameraRightWorld = new THREE.Vector3()

/**
 * @type {import('three').Vector3} 本常量用于表示物体的世界在各个轴上的缩放值
 * */
const worldScale = new THREE.Vector3()

/**
 * 本函数用于获取给定3D物体在其本地坐标系下的包围球球心和半径
 * @param {import('three').Object3D} object 需要计算投影信息的3D物体
 * @param {import('three').PerspectiveCamera} camera 用于渲染场景的相机
 * @param {HTMLCanvasElement} domElement 渲染场景的DOM元素 (通常是canvas)
 * @return {ScreenProjection} 返回物体在屏幕上的投影信息
 * */
function calcProjection(object, camera, domElement) {
    /** @type {ScreenProjection} */
    const projection = {
        centerPx: {
            x: 0,
            y: 0,
        },
        radiusPx: 0,
        ndcZ: 0,
    }

    if (object === null || object === undefined) {
        return projection
    }

    object.updateWorldMatrix(true, false)
    camera.updateWorldMatrix(true, false)

    const {centerLocal} = getLocalBoundingSphere(object)

    // 计算包围球中心点的世界坐标
    centerWorld.copy(centerLocal).applyMatrix4(object.matrixWorld)
    // 将包围球中心点的世界坐标投影到NDC空间
    centerNDC.copy(centerWorld).project(camera)

    // 将包围球中心点的NDC坐标转换为屏幕坐标
    const rect = domElement.getBoundingClientRect()
    const centerX = (centerNDC.x * 0.5 + 0.5) * rect.width + rect.left
    const centerY = (-centerNDC.y * 0.5 + 0.5) * rect.height + rect.top

    // 计算包围球在世界坐标系下的半径
    // Tips: 这里虽然getWorldRadius()内又调用了一次getLocalBoundingSphere(),
    // Tips: 看起来像是在本函数内调用了2次getLocalBoundingSphere(),但实际上getLocalBoundingSphere()
    // Tips: 内部是有缓存的,所以第2次调用几乎没有成本
    const radiusWorld = getWorldRadius(object)

    // 计算相机右方向的单位向量
    cameraRightWorld.setFromMatrixColumn(camera.matrixWorld, 0).normalize()

    // 计算在世界坐标系下,从包围球的球心出发,沿着相机右方向延伸1个包围球半径长度后,所在的点的世界坐标
    // 简称该点为右侧采样点
    cameraRightSampleWorld.copy(centerWorld).addScaledVector(cameraRightWorld, radiusWorld)
    // 将右侧采样点的世界坐标转换为NDC坐标
    cameraRightSampleNDC.copy(cameraRightSampleWorld).project(camera)
    // 计算右侧采样点的屏幕坐标
    const edgeX = (cameraRightSampleNDC.x * 0.5 + 0.5) * rect.width + rect.left
    const edgeY = (-cameraRightSampleNDC.y * 0.5 + 0.5) * rect.height + rect.top

    // 在屏幕坐标系中,右侧采样点与包围球中心点的距离,即为包围球在当前相机视角中,投影到屏幕中的半径
    const deltaX = edgeX - centerX
    const deltaY = edgeY - centerY
    const radiusPx = Math.hypot(deltaX, deltaY)

    projection.centerPx.x = centerX
    projection.centerPx.y = centerY
    projection.radiusPx = radiusPx
    projection.ndcZ = centerNDC.z

    return projection
}

/**
 * 本函数用于计算物体包围球在世界坐标系下的半径(本地半径 * 世界缩放的最大分量)
 * @param {import('three').Object3D} object 需要计算包围球半径的3D物体
 * @return {number} 返回物体包围球在世界坐标系下的半径(未配置hoverRadius时为0)
 * */
function getWorldRadius(object) {
    const {radiusLocal} = getLocalBoundingSphere(object)
    object.getWorldScale(worldScale)
    const maxScale = Math.max(worldScale.x, worldScale.y, worldScale.z) || 1
    return radiusLocal * maxScale
}

/**
 * 本函数用于获取给定3D物体在其本地坐标系下的包围球球心和半径
 *
 * 设计契约:
 *      - 调用方传入的object必须是叶子节点Mesh(该Mesh为投射检测命中的Mesh)的祖先anchor Object3D,
 *        实际上是Group,即sunAxis或planet.root
 *      - anchor Object3D的userData中需配置hoverRadius,表示世界空间下的hover区域半径
 *      以上2个条件中,任一条件不满足,则本函数返回的LocalBoundingSphere.radiusLocal字段值为0,
 *      此时投影圆将缩成一个点,便于测试发现问题
 *      - centerLocal始终为(0, 0, 0): 因为anchor Object3D自身的世界位置就是天体的几何中心
 *
 * Tips: 返回值会被缓存到anchor Object3D的userData中,后续调用会直接命中缓存,因此**调用方不应修改返回字段**
 * @param {import('three').Object3D} object 需要计算包围球的3D物体
 * @return {LocalBoundingSphere} 物体包围球在物体本地坐标系下的球心和半径
 * */
function getLocalBoundingSphere(object) {
    const cacheKey = '__hoverLocalSphere'
    const cached = object.userData[cacheKey]
    if (cached !== undefined && cached !== null) {
        return cached
    }

    /** @type {LocalBoundingSphere} */
    const localSphere = {
        centerLocal: new THREE.Vector3(),
        radiusLocal: 0,
    }

    // Tips: 此处读取的是配置层的hover.radius,然后直接存入数学层的radiusLocal
    // Tips: 因为anchor Object3D是没有经过scale的,所以可以直接使用这个数值
    const configured = object.userData.hoverRadius
    if (typeof configured === 'number' && configured > 0) {
        localSphere.radiusLocal = configured
    }

    object.userData[cacheKey] = localSphere

    return localSphere
}

/**
 * 本函数用于计算指针位置到物体投影边缘的距离 (单位: 像素)
 * @param {{x: Number, y: Number}} pointerPx 指针在屏幕坐标系下的位置
 * @param {{x: Number, y: Number}} centerPx 物体投影中心在屏幕坐标系下的位置
 * @param {Number} radiusPx 物体投影在屏幕坐标系下的半径
 * @return {Number} 返回在屏幕坐标系下指针位置到物体投影边缘的距离
 * - 返回值 > 0: 表示指针在投影边缘外部
 * - 返回值 = 0: 表示指针在投影边缘上
 * - 返回值 < 0: 表示指针在投影边缘内部
 * */
function distanceToProjectionEdgePx(pointerPx, centerPx, radiusPx) {
    // console.log('接收到的鼠标位置: ', pointerPx)
    // console.log('接收到的投影中心位置: ', centerPx)
    // console.log('接收到的投影半径: ', radiusPx)

    const deltaX = pointerPx.x - centerPx.x
    const deltaY = pointerPx.y - centerPx.y
    const distanceToCenter = Math.hypot(deltaX, deltaY)

    // console.log('distanceToCenter=', distanceToCenter, 'radiusPx=', radiusPx, 'edge=', distanceToCenter - radiusPx)

    return distanceToCenter - radiusPx
}

export {
    calcProjection,
    distanceToProjectionEdgePx,
    getWorldRadius,
}