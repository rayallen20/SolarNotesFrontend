import axiosInstance from "@/lib/request.js";

/**
 * @typedef {Object} CatalogueNode 目录树节点
 * @property {Number} id 节点唯一id
 * @property {String} type 节点类型:
 *      - folder: 文件夹
 *      - file: 文件
 * @property {String} name 节点名称
 * @property {String} [intro] 章节简介 (仅当type为folder时存在)
 * @property {String} [createdAt] 创建时间,格式: YYYY-MM-DD (仅当type为folder时存在)
 * @property {Array<CatalogueNode>} [children] 子节点列表 (仅当type为folder时存在)
 * */

/**
 * 本函数用于请求指定书籍目录树API
 * @param {Number} id 书籍id
 * @return {Promise<{catalogue: CatalogueNode}>} 含目录树根节点的Promise对象
 * */
function getCatalogue(id) {
    const uri = '/v1/catalogue/show'
    const param = {
        book: {
            id: id,
        }
    }

    return axiosInstance.post(uri, param)
}

export {
    getCatalogue,
}