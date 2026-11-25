import axiosInstance from "@/lib/request.js";

/**
 * 本函数用于请求指定天体的书籍列表API
 * @param {String} id 被聚焦天体的十进制字符串 ID，取自锚点组的 userData.id
 * @return {Promise<{bookList: Array<import('@/stores/book.js').BookItem>}>} 含书籍列表的Promise对象
 * */
function getList(id) {
    const uri = '/v1/book/list'
    const param = {
        planet: {
            id: id,
        }
    }

    return axiosInstance.post(uri, param)
}

export {
    getList,
}