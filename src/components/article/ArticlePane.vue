<template>
    <div class="article-pane" :class="[stateClass, {'has-mask': articleStore.hasMask}]">
        <div ref="body" class="article-body">
            <!-- 激活态: 梯形 + 标题 + md文档正文 -->
            <template v-if="articleStore.renderPhase === RenderPhase.leaf">
                <h2 class="title">
                    <div class="left-trapezoid"></div>
                    <div class="literal">{{articleStore.activeNode.name}}</div>
                </h2>

                <div class="article-content markdown-body" v-html="articleStore.articleHtml"></div>

                <span class="created-at">{{articleStore.activeNode.createdAt}}</span>
            </template>

            <!-- 非激活态: 标题 + 简介 -->
            <template v-else>
                <h2 class="title">{{articleStore.activeNode.name}}</h2>

                <div class="article-content content">{{articleStore.activeNode.intro}}</div>

                <span class="created-at">{{articleStore.activeNode.createdAt}}</span>
            </template>
        </div>

        <!-- 底部按钮 -->
        <!-- 阅读态(选中节点为叶子节点 && 焦点在文章区): 按钮为胶囊形,点击按钮后将焦点转移到目录区 -->
        <button
            v-if="articleStore.renderPhase === RenderPhase.leaf && !articleStore.hasMask"
            class="bottom-button"
            @click="articleStore.focusCatalogue"
        >
            <i class="iconfont icon-icon_mulu"></i>
            <span class="literal">专注目录</span>
        </button>

        <!-- 专注态(选中节点为叶子节点 && 聚焦在目录区): 按钮水平占满文章区,点击按钮后将焦点转移到文章区 -->
        <button
            v-else-if="articleStore.hasMask"
            class="has-mask-button"
            @click="articleStore.focusArticle"
        >
            开启文章
        </button>

        <!-- 浏览态(初态): 按钮水平占满文章区,点击按钮后选中非叶节点下的第1个叶子节点 -->
        <button
            v-else
            class="bottom-button"
            @click="articleStore.openArticle"
        >
            开启文章
        </button>
    </div>
</template>

<script setup>
import {computed, nextTick, onMounted, useTemplateRef, watch} from "vue";
import {RenderPhase} from "@/lib/enum.js";
import SimpleBar from "simplebar";
import {useArticleStore} from "@/stores/article.js";

defineOptions({
    name: 'ArticlePane',
})

/**
 * @type {import('@/stores/article.js').ArticleStore} 文章阅读页面状态机的实例
 * */
const articleStore = useArticleStore()

/**
 * @type {import('vue').ComputedRef<String>} 文章区当前状态对应的CSS类名
 * */
const stateClass = computed(() => {
    return articleStore.renderPhase === RenderPhase.leaf ? 'article-active' : 'article-inactive'
})

/**
 * @type {Readonly<ShallowRef<HTMLDivElement|null>>} 文章区内容容器的DOM元素
 * */
const bodyRef = useTemplateRef('body')

/**
 * @type {SimpleBar|null} 自定义样式滚动条实例
 * */
let scrollbar = null

onMounted(() => {
    // 为.article-body挂载SimpleBar
    scrollbar = new SimpleBar(bodyRef.value)
})

// Tips: 从store中读到的Proxy对象会自动解包,因此在组件中拿到的就是一个普通对象,无法被watch
// Tips: 因此要使用getter()函数的形式,才能被watch()函数监听
watch(() => articleStore.activeNode, async () => {
    await nextTick()

    if (scrollbar !== null) {
        scrollbar.recalculate()
    }
})
</script>

<style scoped>
.article-pane {
    color: #FFFFFF;
    font-family: "Source Han Serif CN", serif;
    font-style: normal;
    position: relative;
    overflow: hidden;
    transition: width 0.8s ease-in-out;
}

.article-pane .article-body {
    position: relative;
    height: 100%;
    min-height: 0;
    overflow: auto;
}

.article-pane .title {
    margin: 38px 38px 38px 39px;
    font-size: 40px;
    font-weight: 700;
    line-height: 40px;
    letter-spacing: 2px;
}

.article-pane .content {
    margin: 0 38px 38px 39px;
    font-size: 18px;
    font-weight: 400;
    line-height: 38px;
    letter-spacing: 1px;
}

.article-pane .created-at {
    display: block;
    padding-right: 38px;
    width: 100%;
    text-align: right;
}

/* 激活态样式 */
.article-active {
    width: var(--pane-active-width);
}

/* 激活态且有蒙版时,即为专注目录态.此时文章区仍保持激活态样式,仅收窄宽度即可 */
.article-active.has-mask {
    width: calc(100% - var(--pane-active-width) - var(--pane-gap));
}

.article-active .article-body {
    /* 给底部留空间 避免内容被悬浮按钮挡住 */
    padding-bottom: 68px;
}

.article-active .title {
    display: flex;
    column-gap: 20px;
}

.article-active .title .left-trapezoid {
    width: 8px;
    height: 40px;
    background: #20C6D8;
    clip-path: polygon(0px 0px, 8px 7px, 8px 33px, 0px 40px);
}

.article-active .title .literal {
    font-size: 40px;
    font-weight: 700;
    line-height: 40px;
    letter-spacing: 2px;
}

.article-active .bottom-button {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 206px;
    height: 54px;
    padding: 15px 0;
    gap: 9px;
    border-radius: 30px 0 20px 0;
    border: 1px solid #2CFBFF;
    background: linear-gradient(270deg, rgba(44, 251, 255, 0.30) 0%, rgba(44, 251, 255, 0.10) 100%);
    color: #2CFBFF;
    font-family: "Source Han Serif CN", serif;
    font-size: 20px;
    font-style: normal;
    font-weight: 700;
    line-height: 20px;
    letter-spacing: 1px;
}

.article-active .bottom-button::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 30px 0 20px 0;
    background: linear-gradient(270deg, rgba(44, 251, 255, 0.50) 0%, rgba(44, 251, 255, 0.15) 100%);
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
}

.article-active .bottom-button:hover::before {
    opacity: 1;
}

.article-active .bottom-button i {
    font-size: 20px;
    color: #2CFBFF;
}

.article-active .bottom-button > * {
    position: relative;
    z-index: 1;
}

/* 非激活态样式 */
.article-inactive {
    width: calc(100% - var(--pane-active-width) - var(--pane-gap));
    pointer-events: none;
}

.article-inactive .article-body {
    padding-bottom: 121px;
}

.article-inactive .bottom-button {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 2;
    /* 防止伪元素溢出 */
    overflow: hidden;
    width: 100%;
    height: 107px;
    color: #2CFBFF;
    border-radius: 0 0 20px 20px;
    background: linear-gradient(0deg, rgba(44, 251, 255, 0.20) 0%, rgba(44, 251, 255, 0) 100%);
    font-family: "Source Han Serif CN", serif;
    font-size: 30px;
    font-style: normal;
    font-weight: 700;
    line-height: 107px;
    letter-spacing: 2px;
    pointer-events: auto;
}

.article-inactive .bottom-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(0deg, rgba(44, 251, 255, 0.40) 0%, rgba(44, 251, 255, 0.00) 100%);
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
}

.article-inactive .bottom-button:hover::before {
    opacity: 1;
}

.article-inactive .bottom-button > * {
    position: relative;
    z-index: 1;
}

/* SimpleBar注入层 */
.article-inactive .article-body :deep(.simplebar-content) {
    display: flex;
    flex-direction: column;
}

.article-inactive .article-body :deep(.simplebar-content-wrapper) {
    height: 100%;
}

/* 蒙版样式 */
.article-active .article-body::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.8s ease;
    background: linear-gradient(90deg, rgba(0, 0, 0, 0.30) 0.23%, rgba(0, 0, 0, 0.30) 99.78%);
}

.article-active.has-mask .article-body::after {
    opacity: 1;
}

/* 专注目录态时的按钮样式 */
.has-mask-button {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 107px;
    color: #2CFBFF;
    border-radius: 0 0 20px 20px;
    background: linear-gradient(0deg, rgba(44, 251, 255, 0.20) 0%, rgba(44, 251, 255, 0) 100%);
    font-family: "Source Han Serif CN", serif;
    font-size: 30px;
    font-style: normal;
    font-weight: 700;
    line-height: 107px;
    letter-spacing: 2px;
    pointer-events: auto;
}

.has-mask-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(0deg, rgba(44, 251, 255, 0.40) 0%, rgba(44, 251, 255, 0.00) 100%);
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
}

.has-mask-button:hover::before {
    opacity: 1;
}

.article-content {
    margin: 0 38px 38px 39px;
}
</style>