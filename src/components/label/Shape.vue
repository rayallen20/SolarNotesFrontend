<template>
    <div class="shape">
        <!-- 边框层开始 -->
        <BorderLayer></BorderLayer>
        <!-- 边框层结束 -->

        <!-- 内部装饰层开始 -->
        <!-- Tips: 这里的内部是指装饰件在裁剪区域内部 -->
        <InnerDecorLayer></InnerDecorLayer>
        <!-- 内部装饰层结束 -->
    </div>
</template>

<script setup>
import BorderLayer from "@/components/label/shape/BorderLayer.vue";
import InnerDecorLayer from "@/components/label/shape/InnerDecorLayer.vue";

defineOptions({
    name: 'Shape',
})
</script>

<style scoped>
/* 标签裁剪区域开始 */
.shape {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(90deg, rgba(5, 9, 18, 0.90) 0%, rgba(5, 9, 18, 0.40) 49.98%, rgba(5, 9, 18, 0.90) 99.97%);

    /* 裁剪开始 */
    clip-path: polygon(
        /* label左上点位 */
        0px 0px,

            /* 顶部凹口开始 */
            /* 凹口起点 */
        var(--notch-start-x) 0px,
            /* 凹口左斜下点 */
        var(--top-notch-left-diagonal-end-x) var(--notch-depth),
            /* 凹口底部水平线 */
        var(--top-notch-horizontal-end-x) var(--notch-depth),
            /* 凹口终点 */
        var(--top-notch-right-diagonal-end-x) 0px,
            /* 顶部凹口结束 */

            /* label右上点位 */
        var(--width) 0px,
            /* label右下点位 */
        var(--width) var(--height),

            /* 底部凹口开始 */
            /* 凹口起点 */
        var(--bottom-notch-right-diagonal-start-x) var(--height),
            /* 凹口右斜上点 */
        var(--bottom-notch-right-diagonal-end-x) var(--bottom-notch-right-diagonal-end-y),
            /* 凹口顶部水平线 */
        var(--bottom-notch-horizontal-end-x) var(--bottom-notch-right-diagonal-end-y),
            /* 凹口终点 */
        var(--bottom-notch-left-diagonal-end-x) var(--height),
            /* 底部凹口结束 */

            /* label左下角 */
        0px var(--height),
            /* 左外边框与塌陷的连接点 */
        0px var(--left-collapse-start-y),

            /* 左侧塌陷开始 */
            /* 塌陷起始点 */
        var(--left-collapse-start-x) var(--left-collapse-start-y),
            /* 塌陷结束点 */
        var(--left-collapse-start-x) var(--left-collapse-end-y),
            /* 塌陷与左外边框的连接点 */
        0px var(--left-collapse-end-y),
            /* 左侧塌陷结束 */

            /* 裁剪终点(闭合) */
        0px 0px
    );
    /* 裁剪结束 */
}
/* 标签裁剪区域结束 */
</style>