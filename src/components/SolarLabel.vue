<template>
    <div
        class="solar-label"
        ref="container"
        :style="positionStyle"
        :class="{'is-visible': hoverStore.shouldShowLabel}"
        @pointerenter="onPointerEnter"
        @pointerleave="onPointerLeave"
    >
        <!-- 裁剪区域开始 -->
        <Shape></Shape>
        <!-- 裁剪区域结束 -->

        <!-- 外部装饰件层开始 -->
        <!-- Tips: 这里的外部是指装饰件在裁剪区域的外部 -->
        <OuterDecorLayer></OuterDecorLayer>
        <!-- 外部装饰件层结束 -->

        <!-- 内容层开始 -->
        <ContentLayer></ContentLayer>
        <!-- 内容层结束 -->
    </div>
</template>

<script setup>
import Shape from "@/components/label/Shape.vue";
import OuterDecorLayer from "@/components/label/OuterDecorLayer.vue";
import ContentLayer from "@/components/label/ContentLayer.vue";
import {useHoverStore} from "@/stores/hover.js";
import {computed, nextTick, onMounted, ref, useTemplateRef, watch} from "vue";

defineOptions({
    name: 'SolarLabel',
})

/**
 * @type {Number} 视口安全边距阈值:
 * - label与视口下边缘的距离需大于该值,label才能出现在投影圆的正下方
 * - 否则label需要翻转到投影圆的正上方
 * */
const VIEWPORT_SAFE_MARGIN_THRESHOLD_PX = 8

/**
 * @type {import('vue').Ref<Number>} label的宽度
 * */
const labelWidth = ref(0)

/**
 * @type {import('vue').Ref<Number>} label的高度
 * */
const labelHeight = ref(0)

/**
 * @type {import('vue').Ref<Number>} 折线凹口深度
 * */
const notchDepth = ref(0)

onMounted(() => {
    const style = getComputedStyle(containerRef.value)

    labelWidth.value = parseFloat(style.getPropertyValue('--width'))
    labelHeight.value = parseFloat(style.getPropertyValue('--height'))
    notchDepth.value = parseFloat(style.getPropertyValue('--notch-depth'))
})

/**
 * @type {Readonly<import('vue').ShallowRef<HTMLDivElement|null>>} 模板引用,指向.solar-label容器DOM元素
 * */
const containerRef = useTemplateRef('container')

/**
 * @type {import('@/stores/hover.js').HoverStore} 悬停状态机实例
 * */
const hoverStore = useHoverStore()

/**
 * @type {import('vue').ComputedRef<{left: String, top: String}>} 用于为label做绝对定位的CSS样式
 * - 视口内可放置时: label的顶部凹口中点位于投影圆圆心正下方,即: 顶部凹口中点与投影圆相切
 * - 视口内不可放置时: label翻转到投影圆圆心的正上方,此时label底部凹口中点位于投影圆圆心正上方,即: 底部凹口中点与投影圆相切
 * */
const positionStyle = computed(() => {
    const projection = hoverStore.activeProjection
    const centerX = projection.centerPx.x
    const centerY = projection.centerPx.y
    const radius = projection.radiusPx

    const width = labelWidth.value
    const height = labelHeight.value
    const depth = notchDepth.value

    // 水平位置: 凹口中点在投影圆圆心的正下方
    const left = centerX - width / 2

    // 垂直位置: 顶部凹口中点位于投影圆底部,即: 顶部凹口中点与投影圆相切
    const downTop = centerY + radius - depth
    const downBottom = downTop + height

    // 翻转判定: 若label下底边超过视口安全边距阈值,则需要翻转到投影圆正上方
    const shouldFlipUp = downBottom > window.innerHeight - VIEWPORT_SAFE_MARGIN_THRESHOLD_PX

    // 计算垂直位置
    let top = downTop
    if (shouldFlipUp) {
        top = centerY - radius - (height - depth)
    }

    return {
        left: `${left}px`,
        top: `${top}px`,
    }
})

/**
 * 本函数是容器div的pointerenter事件回调:
 * @param {PointerEvent} event pointerenter事件对象
 * 函数内的操作:
 *      1. 标记鼠标进入label(或者说已悬停在label上)
 * Tips: 计算属性isActiveLocked需要根据isLabelHover判断,因此状态机在label状态下会锁定activeEntity
 * */
function onPointerEnter(event) {
    hoverStore.setLabelHover(true)
}

/**
 * 本函数是容器div的pointerleave事件回调:
 * @param {PointerEvent} event pointerleave事件对象
 * 该函数内的操作:
 *      1. 标记鼠标离开label
 * */
function onPointerLeave(event) {
    hoverStore.setLabelHover(false)
}

/**
 * label的显隐状态或位置变化后,需重新计算label的DOMRect对象并上报(写入)给store,该DOMRect对象用于让
 * tickHover()函数做滞后反应判定:
 *      - shouldShowLabel有变更: 决定是否上报DOMRect对象
 *          - 非idle状态变更到idle状态: 上报DOMRect对象
 *          - idle状态变更到非idle状态: 不上报DOMRect对象(置空)
 *              这是为了让tickHover()函数知道**当前没有label**,以便将isNearLabel复位为false
 *      - positionStyle有变更: 说明activeProjection的中心点发生了变化,需要上报新的DOMRect对象以更新位置
 *      - immediate: 首次挂载时也运行一次,让store.labelRect和渲染状态同步
 * */
watch(
    () => {
        return [
            hoverStore.shouldShowLabel,
            positionStyle.value.left,
            positionStyle.value.top,
        ]
    },
    async () => {
        // Tips: 等待下一次DOM更新完成后再获取显隐状态和位置
        // 这里主要是为了等DOM的positionStyle更新后再获取位置
        await nextTick()

        if (!hoverStore.shouldShowLabel || containerRef.value === null) {
            hoverStore.setLabelRect(null)
            return
        }

        if (hoverStore.shouldShowLabel) {
            const rect = containerRef.value.getBoundingClientRect()
            hoverStore.setLabelRect(rect)
        }
    },
    {
        immediate: true,
    }
)

</script>

<style scoped>
/* 定义变量 */
.solar-label {
    /* label宽度 */
    --width: 426px;
    /* label高度 */
    --height: 286px;

    /* 折线相关配置 */
    /* 折线起点的水平位置 */
    --notch-start-x: 60px;
    /* 折线凹口深度 */
    --notch-depth: 16px;
    /* 折线斜边水平距离 Tips: run有延伸的意思 */
    --notch-run-x: 48px;
    /* 折线中水平线的宽度 = label宽度 - 起点水平位置 * 2 - 折线斜边水平距离 * 2 */
    --notch-horizontal-width: calc(var(--width) - var(--notch-start-x) * 2 - var(--notch-run-x) * 2);

    /* 按钮相关配置 */
    --btn-width: 146px;
    /* 按钮中心点的水平位置 */
    --btn-center-x: 213px;

    /* 左侧轨道区域相关配置 */
    /* 左侧轨道宽度 */
    --left-rail-width: 3px;
    /* 左侧轨道上边框宽度 */
    --left-rail-top-width: 3px;
    /* 左侧轨道上边框高度 */
    --left-rail-top-height: 162px;
    /* 左侧轨道中边框宽度 */
    --left-rail-middle-width: 1px;
    /* 左侧轨道中边框高度 */
    --left-rail-middle-height: 53px;
    /* 左侧轨道下边框宽度 */
    --left-rail-bottom-width: 3px;
    /* 左侧轨道下边框高度 */
    --left-rail-bottom-height: 71px;

    /* 垂直方向颜色线性渐变 (亮 -> 暗 -> 亮) */
    --vertical-grad: linear-gradient(
        180deg,
        rgba(81,188,255,1) 0%,
        rgba(81,188,255,0.1) 50%,
        rgba(81,188,255,1) 100%
    );
}

/* 标签容器开始 */
.solar-label {
    position: fixed;
    /* TODO: 此处是为了看到 最后要还原成0 */
    top: 0;
    left: 0;
    width: var(--width);
    height: var(--height);

    /* 控制显隐的属性 */
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
        opacity 0.5s linear,
        visibility 0s linear 0.5s;

    /* 顶部折线计算 */
    /* 顶部折线中 左折线结束点的水平位置 = 折线起点的水平位置 + 折线斜边水平距离 */
    --top-notch-left-diagonal-end-x: calc(var(--notch-start-x) + var(--notch-run-x));
    /* 顶部折线中 水平线结束点的水平位置 = 左折线结束点的水平位置 + 水平线宽度 */
    --top-notch-horizontal-end-x: calc(var(--top-notch-left-diagonal-end-x) + var(--notch-horizontal-width));
    /* 顶部折线中 右折线结束点的水平位置 = 水平线结束点的水平位置 + 折线斜边水平距离 */
    --top-notch-right-diagonal-end-x: calc(var(--top-notch-horizontal-end-x) + var(--notch-run-x));

    /* 底部折线计算 */
    /* 底部折线中 右折线起始点的水平位置 = label宽度 - 折线起点的水平位置 */
    --bottom-notch-right-diagonal-start-x: calc(var(--width) - var(--notch-start-x));
    /* 底部折线中 右折线结束点的水平位置 = 右侧折线起始点的水平位置 - 折线斜边水平距离 */
    --bottom-notch-right-diagonal-end-x: calc(var(--bottom-notch-right-diagonal-start-x) - var(--notch-run-x));
    /* 底部折线中 右折线结束点的垂直位置 = label高度 - 折线凹口深度 */
    --bottom-notch-right-diagonal-end-y: calc(var(--height) - var(--notch-depth));
    /* 底部折线中 水平线结束点的水平位置 = 右折线结束点的水平位置 - 水平线宽度 */
    --bottom-notch-horizontal-end-x: calc(var(--bottom-notch-right-diagonal-end-x) - var(--notch-horizontal-width));
    /* 底部折线中 左折线结束点的水平位置 = 水平线结束点的水平位置 - 折线斜边水平距离 */
    --bottom-notch-left-diagonal-end-x: calc(var(--bottom-notch-horizontal-end-x) - var(--notch-run-x));

    /* 左侧塌陷计算 */
    /* 左侧塌陷起始点的垂直位置 = label高度 - 左侧下边框高 */
    --left-collapse-start-y: calc(var(--height) - var(--left-rail-bottom-height));
    /* 左侧塌陷起始点的水平位置 = 左侧轨道宽 - 左侧中边框宽 */
    --left-collapse-start-x: calc(var(--left-rail-width) - var(--left-rail-middle-width));
    /* 左侧塌陷结束点的垂直位置 = 左侧塌陷起始点的垂直位置 - 左侧中边框高 */
    --left-collapse-end-y: calc(var(--left-collapse-start-y) - var(--left-rail-middle-height));
}

/* 可见态 */
.solar-label.is-visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    /* 显示时立刻可见,再淡入 */
    transition:
        opacity 0.5s linear,
        visibility 0s linear 0s;
}
/* 标签容器结束 */
</style>