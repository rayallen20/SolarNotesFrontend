import {renderer, resizeRenderer} from "@/three/base/renderer.js";
import {initSceneEnvironment, scene} from "@/three/base/scene.js";
import {initSkySphereTexture, setAutoRotation as setSkySphereAutoRotation, skySphere} from "@/three/skySphere.js";
import {createOrbitControls} from "@/three/base/controls.js";
import {camera, resizeCamera} from "@/three/base/camera.js";
import {initSun, setAutoRotation as setSunAutoRotation, sunAxis} from "@/three/sun.js";
import {disposeBloom, initComposers, markAsBloomObject, renderBloomFrame, resizeBloom} from "@/three/postProcess.js";
import {initPlanets, markOuterPlanetsLayer, planets, updatePlanets} from "@/three/planet/index.js";

/**
 * @type {Number|null} 当前动画循环的requestAnimationFrame句柄
 * */
let rafId = null

/**
 * @type {import('three/addons/controls/OrbitControls').OrbitControls|null} 轨道控制器实例
 * */
let controls = null

/**
 * 本函数用于3D场景的初始化:
 * 1. 创建canvas对象并挂载到给定的容器DOM中
 * 2. 初始化
 *      2.1 场景环境贴图
 *      2.2 天空球
 *      2.3 太阳
 *      2.4 行星
 * 3. 加载坐标辅助线(仅开发模式下)
 * 4. 创建轨道控制器
 * 5. 加载后期管线相关功能:
 *      5.1 初始化后期处理管线
 *      5.2 为太阳设置辉光图层
 *      5.3 为外行星设置补光图层
 * 6. 监听视口大小变化
 * 7. 启动动画循环
 * @param {HTMLDivElement} container 要挂载canvas的容器DOM
 * @return {Function} 销毁函数
 * */
export async function initEngine (container) {
    try {
        // 1. 创建canvas对象并挂载到给定的容器DOM中
        container.appendChild(renderer.domElement)

        // 2. 初始化
        // 2.1 场景环境贴图
        await initSceneEnvironment(renderer)
        // 2.2 天空球
        await initSkySphereTexture()
        scene.add(skySphere)
        // 2.3 太阳
        await initSun()
        scene.add(sunAxis)
        // 2.4 行星
        await initPlanets()
        for (const planet of planets) {
            scene.add(planet.axis)
        }

        // 3. 加载坐标辅助线(仅开发模式下)
        if (import.meta.env.DEV) {
            const {axesHelper} = await import('@/three/base/axisHelper.js')
            scene.add(axesHelper)
        }

        // 4. 创建轨道控制器
        controls = createOrbitControls(camera, renderer.domElement)

        // 5. 加载后期管线相关功能
        // 5.1 初始化后期处理管线
        initComposers()
        // 5.2 为太阳设置辉光图层
        markAsBloomObject(sunAxis)
        // 5.3 为外行星设置补光图层
        markOuterPlanetsLayer()

        // 6. 监听视口大小变化
        window.addEventListener('resize', onWindowResize)

        // 7. 启动动画循环
        startAnimation()
    } catch (err) {
        // 清理资源
        dispose()

        // 将canvas元素从DOM树中移除
        renderer.domElement.remove()

        // 清空场景
        scene.clear()

        // 抛出异常
        throw err
    }

    return dispose
}

/**
 * 本函数用于逐帧更新场景并渲染:
 * 1. 更新天空球的自转
 * 2. 更新太阳的自转
 * 3. 更新行星的公转和自转
 * 4. 更新控制器
 * 5. 渲染辉光效果
 * */
function startAnimation () {
    rafId = requestAnimationFrame(startAnimation)

    // 1. 更新天空球的自转
    setSkySphereAutoRotation()

    // 2. 更新太阳的自转
    setSunAutoRotation()

    // 3. 更新行星的公转和自转
    updatePlanets(true)

    // 4. 更新控制器
    controls.update()

    // 5. 渲染辉光效果
    renderBloomFrame()
}

/**
 * 本函数用于在卸载3D场景时:
 * 1. 取消对视口大小的监听
 * 2. 停止动画循环
 * 3. 销毁轨道控制器
 * 4. 销毁后期处理管线
 * 5. 销毁渲染器
 * */
function dispose () {
    // 1. 取消对视口大小的监听
    window.removeEventListener('resize', onWindowResize)

    // 2. 停止动画循环
    if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
    }

    // 3. 销毁轨道控制器
    if (controls !== null) {
        controls.dispose()
        controls = null
    }

    // 4. 销毁后期处理管线
    disposeBloom()

    // 5. 销毁渲染器
    renderer.dispose()
}

/**
 * 本函数用于重置:
 * 1. 相机宽高比
 * 2. 渲染器宽高
 * 3. 后期处理管线宽高
 * */
function onWindowResize () {
    const width = window.innerWidth
    const height = window.innerHeight

    resizeCamera(width, height)
    resizeRenderer(width, height)
    resizeBloom(width, height)
}