import axiosInstance from "@/lib/request.js";

/**
 * 本函数用于请求天体简介列表API
 * @return {Promise<{planets: Array<import('@/three/applyBodyMeta.js').BodyMeta>}>} 包含天体简介列表的Promise对象
 * */
function getList() {
    const uri = "/v1/planet/list"
    return axiosInstance.get(uri)
}

export {
    getList,
}