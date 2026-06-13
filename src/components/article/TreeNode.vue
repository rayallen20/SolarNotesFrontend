<template>
    <li
        class="tree-node"
        :class="[
            `node-${node.type}`,
            {
                'is-collapsed': isCollapsed,
                animating: isAnimating,
                'is-active': isActive,
            }
        ]"
        :style="{'--depth': depth}"
        :data-id="node.id"
    >
        <!-- case1. depth = 0: 根节点对应的行(梯形 + 文字, 无字体图标) -->
        <div
            v-if="depth === 0"
            class="row primary-row"
            @click="onRowClick"
        >
            <div class="left-trapezoid"></div>
            <span class="literal">{{node.name}}</span>
        </div>

        <!-- case2. depth > 0时: 非叶节点对应的行(箭头字体图标 + 文字) -->
        <div
            v-else-if="node.type === CatalogueNodeType.folder"
            class="row folder-row"
            @click="onRowClick"
        >
            <i class="iconfont icon-icon-right"></i>
            <span class="literal">{{node.name}}</span>
        </div>

        <!-- case3. depth > 0时: 叶子节点对应的行(文件字体图标 + 文字) -->
        <div
            v-else
            class="row file-row"
            @click="onRowClick"
        >
            <i class="iconfont icon-icon_file"></i>
            <span class="literal">{{node.name}}</span>
        </div>

        <!-- 子节点: 递归自身 -->
        <ul
            v-if="hasChildren"
            class="children"
            ref="children"
        >
            <TreeNode
                v-for="child in node.children"
                :key="child.id"
                :node="child"
                :depth="depth + 1">
            </TreeNode>
        </ul>
    </li>
</template>

<script setup>
import {computed, useTemplateRef} from "vue";
import {CatalogueNodeType} from "@/lib/enum.js";
import {useArticleStore} from "@/stores/article.js";
import {useCollapseTransition} from "@/composables/useCollapseTransition.js";

/**
 * @typedef {import('@/data/treeData.js').CatalogueNode} CatalogueNode 目录树节点
 * */

defineOptions({
    name: 'TreeNode',
})

const props = defineProps({
    node: {
        type: /** @type {import('vue').PropType<CatalogueNode>} */ (Object),
        required: true,
    },
    depth: {
        type: Number,
        required: true,
    }
})

/**
 * @type {import('@/stores/article.js').ArticleStore} 文章阅读页面状态机实例
 * */
const articleStore = useArticleStore()

/**
 * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识节点是否存在子节点(决定是否递归渲染子级<ul>元素)
 * */
const hasChildren = computed(() => {
    return Array.isArray(props.node.children) && props.node.children.length > 0
})

/**
 * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识非叶节点是否处于折叠状态
 * */
const isCollapsed = computed(() => {
    return articleStore.isCollapsed(props.node.id)
})

/**
 * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识本节点是否为当前选中(激活)节点
 * */
const isActive = computed(() => {
    return props.node.id === articleStore.activeNode.id
})

/**
 * @type {Readonly<import('vue').ShallowRef<HTMLUListElement|null>>} 模板引用,指向子节点容器<ul>元素,用于获取其高度以实现折叠动画
 * */
const childrenRef = useTemplateRef('children')

/**
 * @type {import('vue').Ref<Boolean>} 是否正在播放折叠/展开动画
 * */
const {isAnimating} = useCollapseTransition(childrenRef, () => isCollapsed.value, props.node.id)

/**
 * 本函数用于处理行点击:
 *      - 非叶节点的折叠态切换
 *      - 选中当前节点
 * @param {MouseEvent} event 点击事件对象
 * */
function onRowClick(event) {
    if (props.node.type === CatalogueNodeType.folder && props.depth !== 0) {
        articleStore.toggleCollapsed(props.node.id)
    }

    articleStore.selectNode(props.node.id)
}
</script>

<style scoped>

</style>