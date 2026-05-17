<template>
    <div class="inner-decor-layer">
        <!-- 左侧竖梯形开始 -->
        <Trapezoid class="left"></Trapezoid>
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
}
/* 内部装饰层结束 */
</style>