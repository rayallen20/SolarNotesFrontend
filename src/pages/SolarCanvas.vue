<template>
    <div class="solar-canvas">
        <div ref="container" class="canvas-container"></div>
        <SolarLabel></SolarLabel>
    </div>
</template>

<script setup>
import {onMounted, onBeforeUnmount, useTemplateRef} from 'vue'
import {initEngine} from "@/three/engine.js";
import {useHoverStore} from "@/stores/hover.js";
import {getNDCCoordinate, setLeaveCoordinate} from "@/three/lib/pointer.js";
import SolarLabel from "@/components/SolarLabel.vue";

defineOptions({
    name: 'SolarCanvas',
})

/**
 * @type {Readonly<ShallowRef<HTMLDivElement|null>>} canvas容器的DOM元素
 * */
const containerRef = useTemplateRef('container')

/**
 * @type {import('@/stores/hover.js').HoverStore} 悬停状态机的引用
 * */
const hoverStore = useHoverStore()

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
 * @param {PointerEvent} event pointerleave事件回调
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
 * 本组件挂载完成后:
 *      1. 初始化3D场景(引擎)
 *      2. 若await期间组件已被卸载,则销毁引擎实例并返回
 *      3. 保存引擎返回的canvas DOM元素和销毁函数的引用
 *      4. 在canvas上绑定pointer相关事件
 * */
onMounted(async () => {
    const engine = await initEngine(containerRef.value, hoverStore)
    if (isUnmounted) {
        engine.dispose()
        return
    }

    dispose = engine.dispose
    canvas = engine.canvas

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerenter', onPointerEnter)
    canvas.addEventListener('pointerleave', onPointerLeave)
})

onBeforeUnmount(() => {
    isUnmounted = true

    if (canvas !== null) {
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerenter', onPointerEnter)
        canvas.removeEventListener('pointerleave', onPointerLeave)
    }

    if (dispose !== null) {
        dispose()
    }
})
</script>

<style scoped>
.canvas-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}
</style>