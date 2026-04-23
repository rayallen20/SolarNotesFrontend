import {renderer} from "@/three/base/renderer.js";
import {initSceneEnvironment, scene} from "@/three/base/scene.js";
import {initSkySphereTexture, setAutoRotation as setSkySphereAutoRotation, skySphere} from "@/three/skySphere.js";
import {createOrbitControls} from "@/three/base/controls.js";
import {camera} from "@/three/base/camera.js";
import {initSun, setAutoRotation as setSunAutoRotation, sunAxis} from "@/three/sun.js";

/**
 * @type {Number|null} 当前动画循环的requestAnimationFrame句柄
 * */
let rafId = null

/**
 * @type {import('three/addons/controls/OrbitControls').OrbitControls|null} 轨道控制器实例
 * */
let controls = null

/**
 * 本函数用于:
 * 1. 创建canvas对象并挂载到给定的容器DOM中
 * 2. 初始化
 *      - 场景环境贴图
 *      - 天空球
 *      - 轨道控制器
 *      - 太阳
 * 3. 启动动画循环
 * @param container {HTMLDivElement} 要挂载canvas的容器DOM
 * @return {Function} 销毁函数
 * */
export async function initEngine (container) {
    container.appendChild(renderer.domElement)

    // 初始化场景环境贴图
    await initSceneEnvironment(renderer)

    // 初始化天空球
    await initSkySphereTexture()
    scene.add(skySphere)

    // 初始化太阳
    await initSun()
    scene.add(sunAxis)


    // 仅开发环境加载坐标轴辅助线
    if (import.meta.env.DEV) {
        const {axesHelper} = await import('@/three/base/axisHelper.js')
        scene.add(axesHelper)
    }

    controls = createOrbitControls(camera, renderer.domElement)

    startAnimation()

    return dispose
}

/**
 * 本函数用于每帧更新场景并渲染
 * 更新场景的操作:
 * - 天空球的自转
 * - 太阳的自转
 * */
function startAnimation () {
    rafId = requestAnimationFrame(startAnimation)

    // 更新天空球自转角度
    setSkySphereAutoRotation()

    // 更新太阳自转角度
    setSunAutoRotation()

    controls.update()

    renderer.render(scene, camera)
}

/**
 * 本函数用于在卸载3D场景时 销毁:
 * - 动画循环
 * - 轨道控制器
 * - 渲染器
 * */
function dispose () {
    if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
    }

    if (controls !== null) {
        controls.dispose()
        controls = null
    }

    renderer.dispose()
}