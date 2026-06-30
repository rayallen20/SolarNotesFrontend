import axiosInstance from "@/lib/request.js";

/**
 * @typedef {Object} Article 文章对象(获取文章接口的响应)
 * @property {Number} id 文章id(对应目录树中被选中叶子节点的id)
 * @property {String} content 文章正文(md文本)
 * @property {String} createdAt 文章创建时间,格式: YYYY-MM-DD
 * */

/**
 * 本函数用于请求获取文章内容API
 * @param {Number} id 文章id
 * @return {Promise<{article: Article}>} 包含文章内容API响应的Promise对象
 * */
function getArticle(id) {
    const uri = '/v1/article/show'
    const param = {
        catalogue: {
            id: id,
        }
    }

    return axiosInstance.post(uri, param)
}

export {
    getArticle,
}