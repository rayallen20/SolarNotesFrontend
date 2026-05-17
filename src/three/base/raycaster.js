import * as THREE from 'three'

/**
 * @type {Object} 本对象用于存储射线投射器的配置项
 * @property {import('three').Vector3} origin 射线的起点坐标
 * @property {import('three').Vector3} destination 射线的方向
 * @property {number} near 射线的近裁剪面距离
 * @property {number} far 射线的远裁剪面距离
 * */
const config = {
    origin: new THREE.Vector3(0, 0, 0),
    destination: new THREE.Vector3(0, 0, -1),
    near: 0,
    far: Infinity,
}

/**
 * @type {import('three').Raycaster} 本对象用于检测鼠标悬停时与物体的交互
 * */
const raycaster = new THREE.Raycaster(
    config.origin,
    config.destination,
    config.near,
    config.far
)

/**
 * @type {Array<import('three').Mesh>} 可拾取对象数组.用于存储场景中所有可以被鼠标悬停检测的物体
 * */
let pickableMeshes = []

/**
 * 本函数用于设置可拾取对象数组
 * @param {Array<import('three').Mesh>} meshes 可拾取对象数组
 * */
function setPickable(meshes) {
    pickableMeshes = meshes
}

/**
 * 本函数用于根据鼠标的NDC坐标和相机位置,查找鼠标悬停的物体
 * @param {import('three').Vector2} mouseNDC 鼠标的NDC坐标
 * @param {import('three').PerspectiveCamera} camera 用于渲染场景的相机
 * @return {import('three').Object3D|null} 返回鼠标悬停的物体 如果没有悬停在任何物体上则返回null
 * */
function pickHoveredBody(mouseNDC, camera) {
    raycaster.setFromCamera(mouseNDC, camera)

    const intersects = raycaster.intersectObjects(pickableMeshes, false)

    if (intersects.length === 0) {
        return null
    }

    return intersects[0].object
}

export {
    setPickable,
    pickHoveredBody,
}