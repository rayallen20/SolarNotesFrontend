<template>
    <div class="article-pane" :class="[stateClass, {'has-mask': hasMask}]">
        <div ref="body" class="article-body">
            <!-- 激活态: 梯形 + 标题 + md文档正文 -->
            <template v-if="phase === RenderPhase.leaf">
                <h2 class="title">
                    <div class="left-trapezoid"></div>
                    <div class="literal">{{sample.name}}</div>
                </h2>

                <div class="article-content markdown-body" v-html="renderedMarkdown"></div>

                <span class="created-at">{{sample.createdAt}}</span>
            </template>

            <!-- 非激活态: 标题 + 简介 -->
            <template v-else>
                <h2 class="title">{{sample.name}}</h2>

                <div class="article-content content">{{sample.intro}}</div>

                <span class="created-at">{{sample.createdAt}}</span>
            </template>
        </div>

        <!-- 底部按钮 -->
        <button v-if="phase === RenderPhase.leaf" class="bottom-button">
            <i class="iconfont icon-icon_mulu"></i>
            <span class="literal">专注目录</span>
        </button>

        <button v-else class="bottom-button">
            开启文章
        </button>
    </div>
</template>

<script setup>
import {computed, onMounted, ref, useTemplateRef} from "vue";
import {RenderPhase} from "@/lib/enum.js";
import {renderMarkdownToHtml} from "@/lib/markdown.js";
import SimpleBar from "simplebar";

defineOptions({
    name: 'ArticlePane',
})

/**
 * @type {import('vue').Ref<String>} 文章区当前渲染状态
 * */
const phase = ref(RenderPhase.nonLeaf)

/**
 * @type {import('vue').Ref<Boolean>} 是否显示蒙版
 * */
const hasMask = ref(false)

/**
 * @type {import('vue').ComputedRef<String>} 文章区当前状态对应的CSS类名
 * */
const stateClass = computed(() => {
    return phase.value === RenderPhase.leaf ? 'article-active' : 'article-inactive'
})

// md文档静态示例
const sample = {
    name: '示例文件名称',
    intro: '这是非激活态展示的节点简介文本。',
    createdAt: '2026-01-22',
    markdown: [
        '## 示例标题',
        '',
        '这是一段示例正文,用于验证 `.markdown-body` 主题、代码高亮与滚动。',
        '',
        '- 列表项 A',
        '- 列表项 B',
        '',
        '> 引用块示例',
        '',
        '```js',
        'const a = 1',
        'console.log(a)',
        '```',
        '',
    ].join('\n'),
}

/**
 * @type {import('vue').ComputedRef<String>} 根据md文本渲染后的HTML字符串
 * */
const renderedMarkdown = computed(() => renderMarkdownToHtml(sample.markdown))

/**
 * @type {Readonly<ShallowRef<HTMLDivElement|null>>} 文章区内容容器的DOM元素
 * */
const bodyRef = useTemplateRef('body')

onMounted(() => {
    // 为.article-body挂载SimpleBar
    new SimpleBar(bodyRef.value)
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
    width: 70%;
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
    width: calc(100% - 70% - 31px);
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