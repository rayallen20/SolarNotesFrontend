<template>
    <div class="inner-decor-layer">
        <!-- 左侧竖梯形开始 -->
        <Trapezoid :color="'transparent'" class="left"></Trapezoid>
        <!-- 左侧竖梯形结束 -->
    </div>
</template>

<script setup>
import Trapezoid from "@/components/common/Trapezoid.vue";

defineOptions({
    name: 'InnerDecorLayer',
})
</script>

<style scoped>
/* 内部装饰层开始 */
.inner-decor-layer {
    position: absolute;
    inset: 0;
    /* 装饰层在边框层上方 可以遮挡边框 */
    z-index: 20;
}

.inner-decor-layer .left {
    position: absolute;
    top: 26px;
    left: 3px;
    --gradient-height: var(--height);
    --gradient-offset: 26px;

    /* 左侧竖直梯形的颜色渐变(亮 -> 暗 -> 亮) */
    background-image: linear-gradient(
        180deg,
        rgba(81, 188, 255, 1) 0%,
        rgba(81, 188, 255, 0.1) 50%,
        rgba(81, 188, 255, 1) 100%
    );

    /* 渐变铺满标签全高,再上移26px抵消top,使颜色渐变对齐边框 */
    background-size: 100% var(--height);
    background-position: 0 -26px;
    background-repeat: no-repeat;
}
/* 内部装饰层结束 */
</style>