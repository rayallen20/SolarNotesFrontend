<template>
<div class="cut-off-line"></div>
</template>

<script setup>
defineOptions({
    name: 'CutOffLine',
})
</script>

<style scoped>
.cut-off-line {
    width: 60px;
    height: 3px;
    background: linear-gradient(
        90deg,
        #21AAFF 0%,
        #2CFBFF 100%
    );
    clip-path: polygon(
        6px 0,
        60px 0,
        54px 3px,
        0 3px
    );
}
</style>