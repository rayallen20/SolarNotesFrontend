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
 * @type {import('three').Box3} 本常量用于表示一个给定3D对象的包围盒
 * Tips: 由于需要缓存(不触发GC),所以将用到的对象定义在了函数外部,本文件中后续的常量均因为此原因故定义在函数外部
 * */
const box = new THREE.Box3()

/**
 * @type {import('three').Sphere} 本常量用于表示一个给定3D对象的包围球
 * */
const sphere = new THREE.Sphere()

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
 * @type {import('three').Matrix4} 本常量用于表示一个给定3D对象的世界变换矩阵的逆矩阵
 * */
const inverseMatrixWorld = new THREE.Matrix4()

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
 * 本函数用于计算给定的3D物体在屏幕上的投影信息
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

    const {centerLocal, radiusLocal} = getLocalBoundingSphere(object)

    // 计算包围球中心点的世界坐标
    centerWorld.copy(centerLocal).applyMatrix4(object.matrixWorld)
    // 将包围球中心点的世界坐标投影到NDC空间
    centerNDC.copy(centerWorld).project(camera)

    // 将包围球中心点的NDC坐标转换为屏幕坐标
    const rect = domElement.getBoundingClientRect()
    const centerX = (centerNDC.x * 0.5 + 0.5) * rect.width + rect.left
    const centerY = (-centerNDC.y * 0.5 + 0.5) * rect.height + rect.top

    // 计算包围球在世界坐标系下的半径
    object.getWorldScale(worldScale)
    const maxScale = Math.max(worldScale.x, worldScale.y, worldScale.z) || 1
    const radiusWorld = radiusLocal * maxScale

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
    // TODO: 这里的/2操作是经验 而非原理 是个需要修正的bug
    const radiusPx = Math.hypot(deltaX, deltaY) / 2

    projection.centerPx.x = centerX
    projection.centerPx.y = centerY
    projection.radiusPx = radiusPx
    projection.ndcZ = centerNDC.z

    return projection
}

/**
 * 本函数用于获取给定3D物体在其本地坐标系下的包围球球心和半径
 * Tips: 返回值会被缓存到3D物体的userData中,后续调用会直接命中缓存,因此**调用方不应修改返回字段**
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

    // 优先使用 geometry.boundingSphere 来获取包围球信息
    if (object.isMesh && object.geometry !== undefined && object.geometry !== null) {
        const geometry = object.geometry

        if (geometry.boundingSphere === null) {
            geometry.computeBoundingSphere()
        }

        localSphere.centerLocal.copy(geometry.boundingSphere.center)
        localSphere.radiusLocal = geometry.boundingSphere.radius

        object.userData[cacheKey] = localSphere
        return localSphere
    }

    // setFromObject在计算包围盒时会遍历物体的所有子对象 因此此处使用缓存策略
    // 计算后将结果缓存在object.userData中 避免重复计算
    box.setFromObject(object)
    box.getBoundingSphere(sphere)

    // 将世界坐标转换为物体本地坐标
    inverseMatrixWorld.copy(object.matrixWorld).invert()
    const centerLocal = sphere.center.clone().applyMatrix4(inverseMatrixWorld)

    object.getWorldScale(worldScale)
    // Tips: 这里的 `|| 1`操作是为了防止前面的`Math.max()`出现0/NaN这种假值
    const maxScale = Math.max(worldScale.x, worldScale.y, worldScale.z) || 1
    const radiusLocal = sphere.radius / maxScale

    localSphere.centerLocal.copy(centerLocal)
    localSphere.radiusLocal = radiusLocal

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
}