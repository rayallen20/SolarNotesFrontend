import * as THREE from 'three'

/**
 * 本常量用于定义渲染器实例
 * @type {import('three').WebGLRenderer}
 * */
const renderer = new THREE.WebGLRenderer()

// 开启阴影贴图
renderer.shadowMap.enabled = true

// 阴影柔和
renderer.shadowMap.type = THREE.PCFShadowMap

// 设置输出的颜色空间为SRGB
renderer.outputColorSpace = THREE.SRGBColorSpace

// 使用ACESFilmicToneMapping作为色调映射方式
renderer.toneMapping = THREE.ACESFilmicToneMapping

// 设置曝光度
renderer.toneMappingExposure = 1.2

renderer.setSize(window.innerWidth, window.innerHeight)

/**
 * 本函数用于重置渲染器尺寸
 * @param {Number} width 视口宽度
 * @param {Number} height 视口高度
 * */
function resizeRenderer(width, height) {
    renderer.setSize(width, height)
}

export {
    renderer,
    resizeRenderer,
}