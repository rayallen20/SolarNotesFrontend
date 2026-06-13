<template>
    <div class="reader-body">
        <CatalogueTree class="pane"></CatalogueTree>
        <ArticlePane class="pane"></ArticlePane>
    </div>
</template>

<script setup>
import CatalogueTree from "@/components/article/CatalogueTree.vue";
import ArticlePane from "@/components/article/ArticlePane.vue";

defineOptions({
    name: 'ReaderBody',
})
</script>

<style scoped>
.reader-body {
    /* 左右两栏的间隙宽度 */
    --pane-gap: 31px;
    /* 激活态的面板宽度 */
    --pane-active-width: 70%;

    flex: 1 1 auto;
    /* 防止内部把滚动传递给页面 */
    overflow: hidden;
    display: flex;
    justify-content: space-between;
    column-gap: var(--pane-gap);
    padding: 29px 100px 49px;
}

.pane {
    height: 100%;
    min-height: 0;
    overflow: auto;
    border-radius: 20px;
    border: 1px solid #21AAFF;
    background: linear-gradient(90deg, rgba(0, 0, 0, 0.30) 0.23%, rgba(0, 0, 0, 0.30) 99.78%);
}
</style>