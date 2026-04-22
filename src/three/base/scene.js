import * as THREE from "three"
import {loadEXR} from "@/three/lib/loadEXR.js";

/**
 * 本常量用于定义场景实例
 * @type {import('three').Scene}
 * */
export const scene = new THREE.Scene()

/**
 * 本常量用于定义场景环境贴图的路径
 * @type {String}
 * */
const SCENE_ENVIRONMENT_PATH = '/assets/environment/NightSky_2K_HDR.exr'

/**
 * 本函数用于初始化场景的环境贴图
 * @param {import('three').WebGLRenderer} renderer 渲染器实例
 * @return {Promise<void>}
 * @throws {Error} 若加载EXR贴图失败则抛出错误
 * */
export async function initSceneEnvironment(renderer) {
    const pmRemGenerator = new THREE.PMREMGenerator(renderer)
    // 预编译等距柱状着色器
    pmRemGenerator.compileEquirectangularShader()

    let texture
    try {
        texture = await loadEXR(SCENE_ENVIRONMENT_PATH)
    } catch (err) {
        console.log('加载EXR环境贴图失败:', err)
        pmRemGenerator.dispose()
        throw err
    }

    // 将等距柱状贴图转换为 PMREM环境贴图
    const envMap = pmRemGenerator.fromEquirectangular(texture).texture

    // 释放原始纹理和生成器
    texture.dispose()
    pmRemGenerator.dispose()

    // 设置为场景的环境贴图
    // Tips: 这里没有设置场景的背景 是因为场景的背景由天空球实现
    // Tips: 否则无法实现场景背景的播放
    scene.environment = envMap
}