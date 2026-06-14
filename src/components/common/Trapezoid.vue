<template>
    <div class="trapezoid" :style="trapezoidStyle"></div>
</template>

<script setup>
import {computed} from "vue";

defineOptions({
    name: 'Trapezoid',
})

const props = defineProps({
    width: {
        type: Number,
        default: 8,
    },
    height: {
        type: Number,
        default: 33,
    },
    inset: {
        type: Number,
        default: 5,
    },
    color: {
        type: String,
        default: '#20C6D8',
    }
})

/**
 * @type {import('vue').ComputedRef<Object>} 梯形的尺寸/形状/背景色/裁剪的内联样式
 * clip-path由宽高和内缩量推导得出,右边上下各减掉内缩量,确保更换尺寸时不会变形
 * */
const trapezoidStyle = computed(() => {
    return {
        width: `${props.width}px`,
        height: `${props.height}px`,
        backgroundColor: props.color,
        clipPath: `polygon(
            0 0,
            ${props.width}px ${props.inset}px,
            ${props.width}px ${props.height - props.inset}px,
            0 ${props.height}px
        )`,
    }
})
</script>

<style scoped>
.trapezoid {
    /* 垂直渐变范围: 元素自身高度 */
    --gradient-height: 100%;
    /* 渐变偏移量 */
    --gradient-offset: 0px;
    width: 8px;
    height: 33px;
    clip-path: polygon(
        0px 0px,
        8px 5px,
        8px 28px,
        0px 33px
    );
    background-image: var(--vertical-grad, linear-gradient(
        180deg,
        rgba(81,188,255,1) 0%,
        rgba(81,188,255,0.1) 50%,
        rgba(81,188,255,1) 100%
    ));
    background-size: 100% var(--gradient-height);
    background-position: 0 calc(-1 * var(--gradient-offset));
    background-repeat: no-repeat;
}
</style>