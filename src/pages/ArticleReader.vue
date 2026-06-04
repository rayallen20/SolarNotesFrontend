<template>
    <div class="article-reader">
        <!-- 头部区域开始 -->
        <HeaderBar></HeaderBar>
        <!-- 头部区域结束 -->
    </div>
</template>

<script setup>
import HeaderBar from "@/components/article/HeaderBar.vue";

defineOptions({
    name: 'ArticleReader',
})
</script>

<style scoped>
.article-reader {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: url('@/assets/img/background.jpg') lightgray 50% / cover no-repeat;
}
</style>