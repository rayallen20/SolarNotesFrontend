<template>
    <li
        class="tree-node"
        :class="[`node-${node.type}`, {'is-collapsed': isCollapsed}]"
        :style="{'--depth': depth}"
        :data-id="node.id"
    >
        <!-- case1. depth = 0: 根节点对应的行(梯形 + 文字, 无字体图标) -->
        <div v-if="depth === 0" class="row primary-row">
            <div class="left-trapezoid"></div>
            <span class="literal">{{node.name}}</span>
        </div>

        <!-- case2. depth > 0时: 非叶节点对应的行(箭头字体图标 + 文字) -->
        <div v-else-if="node.type === CatalogueNodeType.folder" class="row folder-row">
            <i class="iconfont icon-icon-right"></i>
            <span class="literal">{{node.name}}</span>
        </div>

        <!-- case3. depth > 0时: 叶子节点对应的行(文件字体图标 + 文字) -->
        <div v-else class="row file-row">
            <i class="iconfont icon-icon_file"></i>
            <span class="literal">{{node.name}}</span>
        </div>

        <!-- 子节点: 递归自身 -->
        <ul v-if="hasChildren" class="children">
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
import {computed} from "vue";
import {CatalogueNodeType} from "@/lib/enum.js";

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
 * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识节点是否存在子节点(决定是否递归渲染子级<ul>元素)
 * */
const hasChildren = computed(() => {
    return Array.isArray(props.node.children) && props.node.children.length > 0
})

/**
 * @type {import('vue').ComputedRef<Boolean>} 本派生量用于标识非叶节点是否处于折叠状态
 * - 静态规则:
 *      - 根节点(depth =0 且 type为CatalogueNodeType.folder)不折叠
 *      - 非根节点(depth ≥ 1 且 type为CatalogueNodeType.folder)折叠
 * */
const isCollapsed = computed(() => {
    return props.node.type === CatalogueNodeType.folder && props.depth >= 1
})
</script>

<style scoped>

</style>