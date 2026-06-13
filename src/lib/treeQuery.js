import {CatalogueNodeType} from "@/lib/enum.js";

/**
 * @typedef {import('@/data/treeData.js').CatalogueNode} CatalogueNode
 * */

/**
 * @typedef {Object} NodeIndexEntry 节点索引项
 * @property {CatalogueNode} node 目标节点
 * @property {Array<CatalogueNode>} path 从根节点开始,到目标节点的父节点为止的路径(不包含目标节点自身)
 * */

/**
 * 本函数以DFS方式在给定的树形结构中查找给定id的节点及该节点的路径
 * @param {CatalogueNode} root 树形结构根节点
 * @param {Number} targetId 目标节点的id
 * @return {{node: CatalogueNode|null, path: Array<CatalogueNode>}}
 *      - node: 命中节点
 *      - path: 路径
 *      - 未查找到目标节点,则node为null,path为[]
 * */
function dfsFindNodeWithPath(root, targetId) {
    if (root.id === targetId) {
        return {
            node: root,
            path: [],
        }
    }

    if (root.type === CatalogueNodeType.folder && Array.isArray(root.children)) {
        for (const child of root.children) {
            const hit = dfsFindNodeWithPath(child, targetId)
            if (hit.node !== null) {
                hit.path.unshift(root)
                return hit
            }
        }
    }

    return {
        node: null,
        path: [],
    }
}

/**
 * 本函数用于以DFS方式查找给定的非叶节点下的第1个叶子节点
 *      - 分工: 本函数只负责:
 *          - 按id定位节点
 *          - 校验该节点是否存在/是否为非叶节点/是否存在子节点
 *          - 若上述校验通过,则调用dfsFirstLeaf函数查找第1个叶子节点
 * @param {CatalogueNode} root 树形结构根节点
 * @param {Number} folderId 给定的非叶节点的节点id
 * @return {CatalogueNode|null}
 *      - 若找到,则返回第1个叶子节点
 *      - 若folderId指代的节点:
 *          - 不是非叶节点
 *          - 无子节点
 *          - 无叶子节点
 *      - 则返回null
 * */
function dfsFindFirstLeafNode(root, folderId) {
    const {node} = dfsFindNodeWithPath(root, folderId)
    if (node === null || node.type !== CatalogueNodeType.folder || !Array.isArray(node.children)) {
        return null
    }

    return dfsFirstLeaf(node)
}

/**
 * 本函数用于以DFS方式查找给定的节点下的第1个叶子节点
 *      - 分工: 不做定位/校验工作,只以DFS方式扫描给定节点下的所有子节点,返回第1个叶子节点
 * @param {CatalogueNode} node 给定的非叶节点
 * @return {CatalogueNode|null}
 *      - 若给定的节点内存在叶子节点,则返回DFS方式查找到的第1个叶子节点
 *      - 否则返回null
 * */
function dfsFirstLeaf(node) {
    if (node.type === CatalogueNodeType.file) {
        return node
    }

    if (node.type === CatalogueNodeType.folder && Array.isArray(node.children)) {
        for (const child of node.children) {
            const found = dfsFirstLeaf(child)
            if (found !== null) {
                return found
            }
        }
    }

    return null
}

/**
 * 本函数用于建立节点id与节点及其路径的映射关系,用于以O(1)的时间复杂度查找节点及其路径
 * @param {CatalogueNode} root 树形结构根节点
 * @return {Map<Number, NodeIndexEntry>} 节点映射,其中:
 *      - key: 节点id
 *      - value: 节点及其路径
 * */
function buildNodeIndex(root) {
    const nodeIndex = new Map()
    const stack = [
        {
            node: root,
            path: [],
        },
    ]

    while (stack.length > 0) {
        const {node, path} = stack.pop()
        nodeIndex.set(node.id, {node, path})

        if (node.type === CatalogueNodeType.folder && Array.isArray(node.children)) {
            const childPath = [...path, node]
            node.children.forEach(child => stack.push({node: child, path: childPath}))
        }
    }

    return nodeIndex
}

/**
 * 本函数用于初始化初态应被折叠节点的id集合.折叠规则:
 *      - 根节点展开
 *      - depth ≥ 1的非叶节点折叠
 * @param {CatalogueNode} root 树形结构根节点
 * @return {Set<Number>} 初态应被折叠节点的id集合
 * */
function initCollapsedIdSet(root) {
    const collapsedIdSet = new Set()
    const stack = [
        {
            node: root,
            depth: 0,
        },
    ]

    while (stack.length > 0) {
        const {node, depth} = stack.pop()
        if (node.type === CatalogueNodeType.folder && depth >= 1) {
            collapsedIdSet.add(node.id)
        }

        if (Array.isArray(node.children)) {
            node.children.forEach(child => stack.push({node: child, depth: depth + 1}))
        }
    }

    return collapsedIdSet
}

/**
 * 本函数用于获取给定叶子节点的md文档内容
 * @param {CatalogueNode} node 要显示内容的叶子节点
 * @return {String} md文本内容
 * */
function getLeafContent(node) {
    if (typeof node.content === 'string' && node.content.trim() !== '') {
        return node.content
    }

    return buildSampleMarkdown(node)
}

/**
 * 本函数为给定节点提供示例md文档内容
 * TODO: 接入axios后由请求API替代,此处仅提供长内容供静态调试使用
 * @param {CatalogueNode} node 要显示内容的叶子节点
 * @return {String} md文本内容
 * */
function buildSampleMarkdown(node) {
    const sectionList = []

    for (let index = 1; index <= 12; index++) {
        sectionList.push(
            `### 示例章节 ${index}\n\n` +
            `这是第 ${index} 段示例正文,用于验证文章区长内容下的滚动 / 排版,含段落、列表、引用和代码块。\n\n` +
            `- 要点 A:滚动条轨道与滑块渐变\n- 要点 B:内容区与底部按钮的遮挡\n- 要点 C:专注 / 恢复切换后滚动条仍生效\n\n` +
            `> 第 ${index} 段引用,观察块级间距。\n\n` +
            '```js\n' + `const chapter = ${index}\nconsole.log('${node.name}', chapter)\n` + '```\n'
        )
    }

    return `## ${node.name}\n\n这是示例 Markdown 长文档,后续替换为真实正文。\n\n` +
        `### 当前节点\n\n- 名称:${node.name}\n- 创建:${node.createdAt}\n- ID:${node.id}\n\n` +
        sectionList.join('\n\n')
}

export {
    dfsFindNodeWithPath,
    dfsFindFirstLeafNode,
    buildNodeIndex,
    initCollapsedIdSet,
    getLeafContent,
}