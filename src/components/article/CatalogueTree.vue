<template>
    <div ref="root" class="catalogue-tree" :class="stateClass">
        <h3>目录&nbsp;Catalogue</h3>
        <ul class="tree">
            <TreeNode :node="catalogueStore.catalogue" :depth="0"></TreeNode>
        </ul>
    </div>
</template>

<script setup>
import {computed, nextTick, onMounted, useTemplateRef, watch} from "vue";
import SimpleBar from "simplebar";
import TreeNode from "@/components/article/TreeNode.vue";
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
import {ensureNodeVisible} from "@/lib/ensureNodeVisible.js";

defineOptions({
    name: 'CatalogueTree',
})

/**
 * @type {import('@/stores/reader/catalogue.js').CatalogueStore} 目录状态机实例
 * */
const catalogueStore = useCatalogueStore()

/**
 * @type {import('vue').ComputedRef<String>} 目录区当前状态对应的CSS类名
 * */
const stateClass = computed(() => {
    return catalogueStore.isCatalogueActive ? 'catalogue-active' : 'catalogue-inactive'
})

/**
 * @type {import('vue').Readonly<ShallowRef<HTMLDivElement|null>>} 目录区域容器的DOM元素
 * */
const rootRef = useTemplateRef('root')

onMounted(() => {
    new SimpleBar(rootRef.value)
})

watch(
    () => catalogueStore.pendingRevealId,
    async (revealId) => {
        if (revealId === null) {
            return
        }

        await nextTick()
        const options = {
            behavior: 'smooth',
            block: 'center',
        }
        ensureNodeVisible(rootRef.value, revealId, options)

        catalogueStore.clearPendingReveal()
    }
)
</script>

<style scoped>
.catalogue-tree {
    padding: 24px 0 0 24px;
    transition:
        width 0.8s ease-in-out,
        opacity 0.8s ease-in-out;

    /* 每层缩进步长 */
    --tree-indent: 21px;
    /* 每层ul的起始缩进 现在的设计中没有这个缩进 本变量用于未来扩展的设计 */
    --tree-base: 0px;
    /* 线条颜色 */
    --tree-line-color: #2CFBFF;
    /* 线条宽度 */
    --tree-line-width: 1px;
    /* li中每个row的高度(即: 折叠状态下li的高度) (row的上下内边距均为12px,字体大小18px,共计42px) */
    --row-height: 42px;
}

/* 状态宽度 */
.catalogue-tree.catalogue-active {
    width: var(--pane-active-width);
    opacity: 1;
    pointer-events: auto;
}

.catalogue-tree.catalogue-inactive {
    width: calc(100% - var(--pane-active-width) - var(--pane-gap));
    opacity: 0.3;
    pointer-events: none;
}

.catalogue-tree h3 {
    margin-bottom: 28px;
    color: #2CFBFF;
    font-size: 38px;
    font-style: normal;
    font-weight: 900;
    line-height: 38px;
    letter-spacing: 2px;
}
</style>

<style>
/* 非scoped样式: 以下样式要透传到TreeNode组件中,故无法使用scoped样式 */

/* 每个节点的第1行 */
.tree-node > .row {
    position: relative;
    width: 100%;
    /* 左缩进 = 深度 * 步长 */
    padding: 12px 0 12px calc(var(--depth) * var(--tree-indent));
    user-select: none;
    /* 所有行均使用可点击的鼠标样式 */
    cursor: url("@/assets/cursors/cursor-pointer.png") 12 0, pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 悬停渐变 */
.tree-node > .row::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(32, 198, 216, 0.10) 0.23%, rgba(32, 198, 216, 0.10) 99.78%);
    opacity: 0;
    transition: opacity 0.8s;
    pointer-events: none;
}

.tree-node > .row:hover::before,
.tree-node.is-active > .row::before {
    opacity: 1;
}

/* 文字在渐变层上 */
.tree-node > .row > * {
    position: relative;
    z-index: 1;
}

/* case1. depth = 0: 根节点对应的行: 梯形 + 24px加粗文字 */
.primary-row {
    display: flex;
    column-gap: 10px;
}

.primary-row .literal {
    color: #FFFFFF;
    font-size: 24px;
    font-style: normal;
    font-weight: 700;
    line-height: 24px;
    letter-spacing: 1px;
    transition: color 0.8s ease;
}

/* case2. depth > 0时: 非叶节点对应的行: 有状态的箭头字体图标 + 文字 */
.node-folder > .folder-row {
    display: flex;
    align-items: center;
    column-gap: 8px;
}

.node-folder > .folder-row .icon-icon-right {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    font-size: 14px;
    color: #20c6d8;
    border: 1px solid #20c6d8;
    border-radius: 1px;
    /* 箭头旋转动效时长与展开/折叠一致 */
    transition: transform 0.3s ease;
    transform-origin: 50% 50%;
}

/* 展开状态时的字体图标样式 */
.node-folder:not(.is-collapsed) > .folder-row .icon-icon-right {
    transform: rotate(90deg);
}

/* 折叠状态时的字体图标样式(回归原样即可) */
.node-folder.is-collapsed > .folder-row .icon-icon-right {
    transform: rotate(0deg);
}

/* 非叶节点和叶子节点的字体样式一致 */
.node-folder > .folder-row .literal,
.node-file > .file-row .literal {
    overflow: hidden;
    color: #FFFFFF;
    text-overflow: ellipsis;
    font-size: 18px;
    font-style: normal;
    font-weight: 500;
    line-height: 18px;
    letter-spacing: 1px;
    transition: color 0.8s ease;
}

.row:hover > .literal,
.tree-node.is-active > .row > .literal {
    color: #2CFBFF;
}

/* case3. depth > 0时: 叶子节点对应的行: 文件字体图标 + 文字 */
.node-file > .file-row {
    display: flex;
    align-items: center;
    column-gap: 8px;
}
.node-file > .file-row .icon-icon_file {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    font-size: 14px;
    color: #20C6D8;
}

/* 折叠/展开: 子ul的高度动画 */
.node-folder > ul {
    overflow: hidden;
    height: auto;
}
.node-folder.animating > ul {
    transition: height 0.3s ease;
    pointer-events: none;
}
.node-folder.is-collapsed > ul {
    height: 0;
}
@media (prefers-reduced-motion: reduce) {
    .node-folder > ul,
    .node-folder.animating > ul {
        transition: none !important;
    }
}

/* 连接线(以li作为相对元素定位) */
.tree li {
    position: relative;
}

.tree ul.children > li::before, .tree ul.children > li::after {
    content: "";
    position: absolute;
    pointer-events: none;
}

.tree ul.children > li {
    /* 竖线水平位置 = 起始缩进 + 深度 * 步长 - 步长/2 */
    --branch-x: calc(var(--tree-base) + var(--depth) * var(--tree-indent) - var(--tree-indent) / 2);
}

/* 横线: 从竖线结束位置连接到节点 */
.tree ul.children > li::before {
    left: var(--branch-x);
    top: calc(var(--row-height) / 2);
    width: calc(var(--tree-indent) / 2);
    border-top: var(--tree-line-width) solid var(--tree-line-color);
}

/* 竖线: 贯穿li */
.tree ul.children > li::after {
    left: var(--branch-x);
    top: 0;
    bottom: 0;
    border-left: var(--tree-line-width) solid var(--tree-line-color);
}

/* 最后一个li: 竖线长度到li的中间位置 */
.tree ul.children > li:last-child::after {
    bottom: auto;
    height: calc(var(--row-height) / 2);
}
</style>