<template>
    <div class="article-reader">
        <!-- 加载中 -->
        <div v-if="catalogueStore.status === RequestStatus.loading" class="reader-loading">
            <span>加载中...</span>
        </div>

        <!-- 加载失败: 点击重试 -->
        <div v-if="catalogueStore.status === RequestStatus.failed" class="reader-failed">
            <span>加载失败</span>
            <button type="button" class="retry" @click="catalogueStore.requestReload()">重试</button>
        </div>

        <template v-if="catalogueStore.status === RequestStatus.success">
            <!-- 头部区域开始 -->
            <HeaderBar></HeaderBar>
            <!-- 头部区域结束 -->

            <!-- 内容区域开始 -->
            <ReaderBody></ReaderBody>
            <!-- 内容区域结束 -->
        </template>
    </div>
</template>

<script setup>
import HeaderBar from "@/components/article/HeaderBar.vue";
import ReaderBody from "@/components/article/ReaderBody.vue";
import 'simplebar/dist/simplebar.css';
import '@/assets/scroll/common.css';
import '@/assets/scroll/verticalScroll.css';
import '@/assets/scroll/horizontalScroll.css';
import '@/assets/markdown.css';
import 'highlight.js/styles/atom-one-dark.css';
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
import {useCatalogueSync} from "@/composables/useCatalogueSync.js";
import {RequestStatus} from "@/lib/enum.js";

defineOptions({
    name: 'ArticleReader',
})

/**
 * @type {import('@/stores/reader/catalogue.js').CatalogueStore} 目录状态机实例
 * */
const catalogueStore = useCatalogueStore()

// 监听路由中的参数(书籍id),请求该书籍的目录并写入catalogueStore
useCatalogueSync()
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

/* 加载态/失败态: 占满剩余空间并居中 */
.article-reader .reader-loading,
.article-reader .reader-failed
{
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    row-gap: 16px;
    color: #CFE8FF;
}

.article-reader .reader-failed .retry {
    padding: 6px 20px;
    font-size: 16px;
    color: #CFE8FF;
    background: transparent;
    border: 1px solid rgba(32, 198, 216, 0.35);
    border-radius: 8px;
    cursor: pointer;
    transition: 0.2s;
}

.article-reader .reader-failed .retry:hover {
    color: #51EEFF;
    border-color: #51EEFF;
}
</style>