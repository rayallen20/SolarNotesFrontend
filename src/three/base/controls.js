import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls'

/**
 * 轨道控制器配置对象
 * @type {Object}
 * @property {import('three').Vector3} target 轨道控制器旋转中心
 * @property {Number} maxDistance 轨道控制器允许的最大缩放距离 Tips: 最大缩放距离必须小于天空球的半径,否则天空球的整个球体就会被缩放进视野范围内
 * */
const config = {
    target: new THREE.Vector3(0, 0, 0),
    maxDistance: 1000,
}

/**
 * 本函数用于创建轨道控制器
 * @param {import('three').PerspectiveCamera} camera - 相机对象
 * @param {HTMLElement} domElement - 渲染器的DOM元素
 * @return {OrbitControls} 轨道控制器实例
 * */
export function createOrbitControls(camera, domElement) {
    const controls = new OrbitControls(camera, domElement)
    controls.target.set(
        config.target.x,
        config.target.y,
        config.target.z,
    )
    controls.maxDistance = config.maxDistance
    controls.update()

    return controls
}