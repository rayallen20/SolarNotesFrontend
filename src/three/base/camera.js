import * as THREE from 'three';
import {layers} from "@/three/base/layers.js";

/**
 * @type {Object} 透视相机的配置对象
 * @property {number} fov 视野角度 Tips: 单位是角度度,而非弧度
 * @property {number} aspect 宽高比 通常为 窗口宽度/窗口高度
 * @property {number} near 近裁剪面距离
 * @property {number} far 远裁剪面距离 Tips: 远裁剪面的距离一定要远远大于天空球的半径,否则天空球会显示成一个黑色球体
 * @property {import('three').Vector3} position 相机位置对象
 * @property {import('three').Vector3} lookAt 相机朝向对象
 * */
const config = {
    fov: 45,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 4000,
    position: new THREE.Vector3(-11, 6, 40),
    lookAt: new THREE.Vector3(0, 0, 0),
}

/**
 * 本常量用于定义透视相机实例
 * @type {import('three').PerspectiveCamera}
 * Tips: 参数示意见@/docs/explain/PerspectiveCamera.png
 * */
const camera = new THREE.PerspectiveCamera(
    config.fov,
    config.aspect,
    config.near,
    config.far,
)

// 设置相机位置
camera.position.set(
    config.position.x,
    config.position.y,
    config.position.z,
)

// 设置相机朝向
camera.lookAt(config.lookAt)

// 设置相机渲染图层
camera.layers.enable(layers.outerPlanets)

/**
 * 本函数用于重置相机宽高比
 * @param {Number} width 视口宽度
 * @param {Number} height 视口高度
 * */
function resizeCamera(width, height) {
    camera.aspect = width / height
    camera.updateProjectionMatrix()
}

export {
    camera,
    resizeCamera,
}