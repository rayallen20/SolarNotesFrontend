<template>
    <div ref="container" class="solar-canvas"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {initEngine} from "@/three/engine.js";

defineOptions({
    name: 'SolarCanvas',
})

/**
 * @type {Ref<HTMLDivElement|null>} 挂载3D场景的容器DOM
 * */
const container = ref(null)

/**
 * @type {Function|null} 场景销毁函数
 * */
let dispose = null

/**
 * @type {Boolean} 标识当前组件是否被卸载.本标量用于防止在组件卸载后继续执行异步操作
 * */
let isUnmounted = false

// 将渲染器的canvas挂载到DOM树上
onMounted(async () => {
    dispose = await initEngine(container.value)
    if (isUnmounted) {
        dispose()
    }
})

onBeforeUnmount(() => {
    isUnmounted = true
    if (dispose !== null) {
        dispose()
    }
})
</script>

<style scoped>
.solar-canvas {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}
</style>