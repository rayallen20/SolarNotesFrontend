<template>
    <div class="trapezoid"></div>
</template>

<script setup>
defineOptions({
    name: 'Trapezoid',
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