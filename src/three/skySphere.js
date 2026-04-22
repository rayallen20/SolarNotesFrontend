import * as THREE from 'three';
import {loadTexture} from "@/three/lib/loadTexture.js";

/**
 * 本常量用于定义天空球相关配置
 * @type {Object}
 * @property {Number} radius 天空球半径
 * @property {Number} widthSegments 天空球几何体宽度分段数
 * @property {Number} heightSegments 天空球几何体高度分段数
 * @property {String} texturePath 天空球贴图路径
 * @property {String} name 天空球网格对象名称
 * @property {Object} autoRotation 天空球自转配置
 * @property {Number} autoRotation.speed 天空球自转的速度
 * */
const config = {
    radius: 2000,
    widthSegment: 64,
    heightSegment: 64,
    texturePath: '/assets/environment/NightSkyHDRI008_TONEMAPPED.jpg',
    name: 'skySphere',
    autoRotation: {
        speed: 0.0005,
    },
}

/**
 * 本常量用于定义天空球几何体
 * @type {import('three').SphereGeometry}
 * */
const geometry = new THREE.SphereGeometry(
    config.radius,
    config.widthSegment,
    config.heightSegment,
)

/**
 * 本常量用于定义天空球材质 该材质用于占位 后续异步加载贴图后会替换掉
 * @type {import('three').MeshBasicMaterial}
 * */
const placeHolderMaterial = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    color: 0x000000,
})

/**
 * 本常量用于定义天空球网格对象
 * @type {import('three').Mesh}
 * */
export const skySphere = new THREE.Mesh(geometry, placeHolderMaterial)
skySphere.name = config.name

/**
 * 本函数用于加载天空球的贴图并应用到天空球网格对象上
 * @throws {Error}
 * */
export async function initSkySphereTexture() {
    let texture
    try {
        texture = await loadTexture(config.texturePath)
    } catch (err) {
        console.error('加载天空球失败: ', err)
        throw err
    }

    texture.colorSpace = THREE.SRGBColorSpace
    // 定义纹理贴图在水平方向上的包裹方式 即UV中的U
    texture.wrapS = THREE.ClampToEdgeWrapping
    // 定义纹理贴图在垂直方向上的包裹方式 即UV中的V
    texture.wrapT = THREE.ClampToEdgeWrapping

    skySphere.material = new THREE.MeshBasicMaterial({
        map: texture,
        // 由于是从里往外看 所以需要渲染背面
        side: THREE.BackSide,
        // 不进行深度写入 避免遮挡其他物体
        depthWrite: false,
    })

    skySphere.material.needsUpdate = true
}

/**
 * 本函数用于设置天空球的自转
 * */
export function setAutoRotation() {
    if (skySphere.rotation.y >= Math.PI * 2) {
        skySphere.rotation.y = 0
    }

    skySphere.rotation.y += config.autoRotation.speed
}