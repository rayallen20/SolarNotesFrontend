<template>
    <div class="solar-canvas">
        <div
            ref="container"
            class="canvas-container"
            :class="{'is-clickable': hoverStore.shouldUseClickableCursor}"
        >
        </div>
        <SolarLabel></SolarLabel>
        <SolarPanel></SolarPanel>
        <KeyboardHint></KeyboardHint>
        <SceneErrorHint :visible="hasInitError" @close="hasInitError = false"></SceneErrorHint>
    </div>
</template>

<script setup>
import {onMounted, onBeforeUnmount, useTemplateRef, onActivated, onDeactivated, ref} from 'vue'
import {initEngine, pauseEngine, resumeEngine} from "@/three/engine.js";
import {useHoverStore} from "@/stores/hover.js";
import {getNDCCoordinate, setLeaveCoordinate} from "@/three/lib/pointer.js";
import SolarLabel from "@/components/SolarLabel.vue";
import {resolveFocusAnchor} from "@/three/interaction/focus.js";
import {camera} from "@/three/base/camera.js";
import {useFocusStore} from "@/stores/focus.js";
import SolarPanel from "@/components/SolarPanel.vue";
import {useKeyboardFocusNav} from "@/composables/useKeyboardFocusNav.js";
import KeyboardHint from "@/components/KeyboardHint.vue";
import {getList} from "@/api/planet.js";
import {applyBodyMeta} from "@/three/applyBodyMeta.js";
import SceneErrorHint from "@/components/SceneErrorHint.vue";

defineOptions({
    name: 'SolarCanvas',
})

/**
 * @type {Number} 判定是否为拖拽事件的阈值
 * - 鼠标抬起时的位置若距离鼠标点击时的位置超过该阈值,则被判定拖拽事件
 * - 否则判定为点击事件
 * */
const DRAG_THRESHOLD_DISTANCE = 5

/**
 * @type {Readonly<ShallowRef<HTMLDivElement|null>>} canvas容器的DOM元素
 * */
const containerRef = useTemplateRef('container')

/**
 * @type {import('@/stores/hover.js').HoverStore} 悬停状态机的引用
 * */
const hoverStore = useHoverStore()

/**
 * @type {import('@/stores/focus.js').FocusStore} 聚焦状态机的引用
 * */
const focusStore = useFocusStore()

/**
 * @type {Function|null} 场景销毁函数
 * */
let dispose = null

/**
 * @type {HTMLCanvasElement|null} 引擎渲染时使用的canvas DOM元素
 * */
let canvas = null

/**
 * @type {Boolean} 标识当前组件是否被卸载.本标量用于防止在组件卸载后继续执行异步操作
 * */
let isUnmounted = false

/**
 * @type {Boolean} 标识引擎构建是否完成(即onMounted()中调用initEngine()是否已经resolve)
 * */
let isEngineReady = false

/**
 * @type {Boolean} 标识当前组件是否处于激活状态(被KeepAlive显示中)
 * */
let isActive = false

/**
 * @type {import('vue').Ref<Boolean>} 标识组件首次初始化是否失败(用于驱动错误提示组件的显隐)
 * */
const hasInitError = ref(false)

/**
 * @type {Number} 鼠标点击时的水平坐标
 * */
let downX = 0

/**
 * @type {Number} 鼠标点击时的垂直坐标
 * */
let downY = 0

/**
 * 本函数是canvas DOM元素的pointermove事件回调
 * @param {PointerEvent} event pointermove事件对象
 * 函数内的操作:
 *      1. 标记指针在canvas内
 *      2. 标记指针已触发过至少一次pointermove事件
 *      3. 计算并写入指针的NDC坐标
 *      4. 写入指针的屏幕像素坐标
 *
 * */
function onPointerMove(event) {
    // 1. 标记指针在canvas内
    hoverStore.setPointerInCanvas(true)

    // 2. 标记指针已触发过至少一次pointermove事件
    hoverStore.markPointerMoved()

    // 3. 计算并写入指针的NDC坐标
    const screenX = event.clientX
    const screenY = event.clientY
    const ndc = hoverStore.pointer.ndcCoordinate
    getNDCCoordinate(screenX, screenY, canvas, ndc)

    // 4. 写入指针的屏幕像素坐标
    hoverStore.setPointerScreen(screenX, screenY)
}

/**
 * 本函数为canvas DOM元素的pointerenter事件回调
 * @param {PointerEvent} event pointerenter事件对象
 * 函数内的操作:
 *      1. 标记指针在canvas内
 * */
function onPointerEnter(event) {
    hoverStore.setPointerInCanvas(true)
}

/**
 * 本函数为canvas DOM元素的pointerleave事件回调
 * @param {PointerEvent} event pointerleave事件对象
 * 函数内的操作:
 *      1. 标记指针离开canvas
 *      2. 将NDC坐标设置为越界哨兵值(避免射线检测在指针离开后仍按照最后一个有效的NDC坐标持续投射)
 * */
function onPointerLeave(event) {
    hoverStore.setPointerInCanvas(false)
    const ndc = hoverStore.pointer.ndcCoordinate
    setLeaveCoordinate(ndc)
}

/**
 * 本函数为canvas DOM元素的pointerdown事件回调
 * @param {PointerEvent} event pointerdown事件对象
 * 函数内的操作:
 *      1. 记录鼠标点击时的屏幕坐标,以便后续在pointerup事件中判定是否为拖拽事件
 * */
function onPointerDown(event) {
    downX = event.clientX
    downY = event.clientY
}

/**
 * 本函数为canvas DOM元素的pointerup事件回调
 * @param {PointerEvent} event pointerup事件对象
 * 函数内的操作:
 *      1. 判定是否为点击事件
 *      2. 若点击处为锚点对象,则进入聚焦动画
 *      3. 若点击处为空白,则进入清除聚焦动画
 * */
function onPointerUp(event) {
    const movedX = event.clientX - downX
    const movedY = event.clientY - downY
    const movedDistance = Math.hypot(movedX, movedY)
    // 若鼠标抬起时与鼠标按下时的距离超过阈值 则被判定为拖拽而非点击
    if (movedDistance > DRAG_THRESHOLD_DISTANCE) {
        // 不需要处理拖拽事件
        return
    }

    const ndcCoordinate = hoverStore.pointer.ndcCoordinate

    // 若点击锚点对象 则进入聚焦动画
    const anchor = resolveFocusAnchor(ndcCoordinate, camera)
    if (anchor !== null) {
        focusStore.requestFocus(anchor)
        hoverStore.enterIdle()
        return
    }

    // 否则即为点击空白处 则进入清除聚焦动画
    focusStore.requestClear()
}

/**
 * 本函数按
 *      - 引擎就绪
 *      - 组件激活
 * 这2个条件,同步引擎的运行/暂停:
 *      - 引擎就绪 且 组件激活: 恢复引擎(启动动画循环)
 *      - 引擎就绪 且 组件未激活: 暂停引擎(停止动画循环,保留场景)
 *      - 引擎未就绪: 不操作(等待initEngine()执行完毕后,由onMounted()再次调用本函数)
 * Tips: 由于resumeEngine()和pauseEngine()均幂等,故本函数可被多个生命周期钩子函数安全重复调用
 * */
function syncEngineRunning() {
    if (!isEngineReady) {
        return
    }

    if (isActive) {
        resumeEngine()
        return
    }

    pauseEngine()
}

/**
 * 本组件挂载完成后:
 *      1. 请求后端API
 *      2. 构建3D场景(若await期间组件已被卸载,则销毁引擎实例并返回)
 *      3. 将API中的数据写入场景中
 *      4. 绑定canvas的pointer事件
 *      5. 引擎初始化完成,按当前激活状态决定是否启动动画循环
 * */
onMounted(async () => {
    try {
        // step1. 请求天体简介API
        const {planets} = await getList()

        // step2. 构建3D场景
        const engine = await initEngine(containerRef.value, hoverStore, focusStore)
        if (isUnmounted) {
            engine.dispose()
            return
        }

        dispose = engine.dispose
        canvas = engine.canvas

        // step3. 将简介以name为匹配键,写入场景中
        applyBodyMeta(planets)

        // step4. 绑定canvas的pointer事件
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerenter', onPointerEnter)
        canvas.addEventListener('pointerleave', onPointerLeave)
        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointerup', onPointerUp)

        // step5. 引擎初始化完成,按当前激活状态决定是否启动动画循环
        isEngineReady = true
        syncEngineRunning()
    } catch (err) {
        // 首次初始化失败: 显示错误提示组件,引擎不启动
        console.error('场景初始化失败:', err)
        hasInitError.value = true
    }
})

async function refreshBodyMeta() {
    try {
        const {planets} = await getList()
        applyBodyMeta(planets)
    } catch (err) {
        console.error('刷新天体简介失败,保留现有内容: ', err)
    }
}

/**
 * 本组件激活时:
 *      1. 修改激活状态标识
 *      2. 按当前激活状态决定是否启动动画循环
 *      3. 重新请求天体简介API(首次激活时由onMounted()生命周期函数负责请求,不在此处请求)
 * */
onActivated(() => {
    isActive = true
    syncEngineRunning()

    if (isEngineReady) {
        refreshBodyMeta()
    }
})

/**
 * 本组件停用时:
 *      1. 修改激活状态标识
 *      2. 按当前激活状态决定是否暂停动画循环
 * */
onDeactivated(() => {
    isActive = false
    syncEngineRunning()
})

onBeforeUnmount(() => {
    isUnmounted = true
    isActive = false

    if (canvas !== null) {
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerenter', onPointerEnter)
        canvas.removeEventListener('pointerleave', onPointerLeave)
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointerup', onPointerUp)
    }

    if (dispose !== null) {
        dispose()
    }
})

useKeyboardFocusNav()
</script>

<style scoped>
.canvas-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}
</style>