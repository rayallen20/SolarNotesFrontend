import {renderer, resizeRenderer} from "@/three/base/renderer.js";
import {initSceneEnvironment, scene} from "@/three/base/scene.js";
import {initSkySphereTexture, setAutoRotation as setSkySphereAutoRotation, skySphere} from "@/three/skySphere.js";
import {createOrbitControls} from "@/three/base/controls.js";
import {camera, resizeCamera} from "@/three/base/camera.js";
import {initSun, pickableMeshes as sunPickableMeshes, setAutoRotation as setSunAutoRotation, sunAxis} from "@/three/sun.js";
import {disposeBloom, initComposers, markAsBloomObject, renderBloomFrame, resizeBloom} from "@/three/postProcess.js";
import {
    getAllPickableMeshes,
    initPlanets,
    markOuterPlanetsLayer,
    planets,
    updatePlanets
} from "@/three/planet/index.js";
import {setPickable} from "@/three/base/raycaster.js";
import {tickHover} from "@/three/interaction/hover.js";
import {tickFocus} from "@/three/interaction/focus.js";

/**
 * @type {Number|null} 当前动画循环的requestAnimationFrame句柄
 * */
let rafId = null

/**
 * @type {import('three/addons/controls/OrbitControls').OrbitControls|null} 轨道控制器实例
 * */
let controls = null

/**
 * @type {import('@/stores/hover.js').HoverStore|null} 当前引擎实例持有的悬停状态机引用
 * */
let hoverStore = null

/**
 * @type {import('@/stores/focus.js').FocusStore|null} 当前引擎实例持有的聚焦状态机引用
 * */
let focusStore = null

/**
 * 本函数用于3D场景的初始化:
 * 1. 创建canvas对象并挂载到给定的容器DOM中
 * 2. 初始化
 *      2.1 场景环境贴图
 *      2.2 天空球
 *      2.3 太阳
 *      2.4 行星
 * 3. 注册可拾取对象列表
 * 4. 加载坐标辅助线(仅开发模式下)
 * 5. 创建轨道控制器
 * 6. 加载后期管线相关功能:
 *      6.1 初始化后期处理管线
 *      6.2 为太阳设置辉光图层
 *      6.3 为外行星设置补光图层
 * 7. 监听视口大小变化
 * 8. 启动动画循环
 * @param {HTMLDivElement} container 要挂载canvas的容器DOM
 * @param {import('@/stores/hover.js').HoverStore} hoverStoreInstance 定义悬停状态机属性和行为的存储实例
 * @param {import('@/stores/focus.js').FocuseStore} focusStoreInstance 定义聚焦状态机属性和行为的存储实例
 * @return {{canvas: HTMLCanvasElement, dispose: Function}} 渲染器使用的canvas DOM元素和销毁函数
 * */
export async function initEngine(container, hoverStoreInstance, focusStoreInstance) {
    hoverStore = hoverStoreInstance
    focusStore = focusStoreInstance

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

        // 3. 注册可拾取对象列表
        setPickable([...sunPickableMeshes, ...getAllPickableMeshes()])

        // 4. 加载坐标辅助线(仅开发模式下)
        if (import.meta.env.DEV) {
            const {axesHelper} = await import('@/three/base/axisHelper.js')
            scene.add(axesHelper)
        }

        // 5. 创建轨道控制器
        controls = createOrbitControls(camera, renderer.domElement)

        // 6. 加载后期管线相关功能
        // 6.1 初始化后期处理管线
        initComposers()
        // 6.2 为太阳设置辉光图层
        markAsBloomObject(sunAxis)
        // 6.3 为外行星设置补光图层
        markOuterPlanetsLayer()

        // 7. 监听视口大小变化
        window.addEventListener('resize', onWindowResize)

        // 8. 启动动画循环
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

    return {
        canvas: renderer.domElement,
        dispose,
    }
}

/**
 * 本函数用于逐帧更新场景并渲染:
 * 1. 更新天空球的自转
 * 2. 更新太阳的自转
 * 3. 维护聚焦状态机的状态变更
 * 4. 仅在非聚焦状态时维护悬停状态机的状态变更
 * 5. 更新行星的公转和自转
 * 6. 更新控制器
 * 7. 渲染辉光效果
 * Tips: 由于本函数由requestAnimationFrame()调度,所以无法传参,这也是为什么把controls/hoverState等
 * 变量设置为全局的原因:
 *      1. 方便销毁
 *      2. 不破坏函数签名(即不需要传参),使得函数更容易被requestAnimationFrame()调度
 * */
function startAnimation() {
    rafId = requestAnimationFrame(startAnimation)
    const now = performance.now()

    // 1. 更新天空球的自转
    setSkySphereAutoRotation()

    // 2. 更新太阳的自转
    setSunAutoRotation()

    // 3. 维护聚焦状态机的状态变更(聚焦的优先级高于悬停)
    tickFocus(now, focusStore, camera, controls)

    // 4. 仅在非聚焦状态时维护悬停状态机的状态变更(聚焦时不显示label)
    if (!focusStore.inFocusMode) {
        tickHover(now, hoverStore, camera, renderer.domElement)
    } else {
        // 聚焦期间tickHover()不被调用,所以需要维护悬停状态机中用于标识鼠标当前是否悬停在可聚焦天体上的标量
        hoverStore.setPointerOverBody(false)
    }

    // 5. 更新行星的公转和自转
    const shouldFreezeRevolution = hoverStore.shouldFreezeRevolution || focusStore.shouldFreezeRevolution
    updatePlanets(!shouldFreezeRevolution)

    // 6. 更新控制器
    controls.update()

    // 7. 渲染辉光效果
    renderBloomFrame()
}

/**
 * 本函数用于在卸载3D场景时:
 * 1. 取消对视口大小的监听
 * 2. 停止动画循环
 * 3. 销毁轨道控制器
 * 4. 销毁后期处理管线
 * 5. 销毁渲染器
 * 6. 复位悬停状态机的引用
 * 7. 复位悬停状态机的引用
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

    // 6. 复位悬停状态机的引用
    hoverStore = null

    // 7. 复位聚焦状态机的引用
    focusStore = null
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