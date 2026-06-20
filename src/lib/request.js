import axios from "axios";

/**
 * @type {String} 后端URL地址
 * */
const baseURL = import.meta.env.VITE_API_BASE_URL

/**
 * @type {Number} 超时时间 单位:毫秒
 * */
const timeout = 5000

/**
 * @type {import('axios').CreateAxiosDefaults} axios实例配置对象
 * */
const options = {
    baseURL,
    timeout,
}

/**
 *  @type {import('axios').AxiosInstance} axios实例
 * */
const axiosInstance = axios.create(options)

axiosInstance.interceptors.request.use(
    config => {
        // Tips: 若后续API有token校验需求 则在此处增加逻辑即可
        return config
    },
    error => {
        return Promise.reject(error)
    },
)

axiosInstance.interceptors.response.use(
    (response) => {
        // 确保仅有效载荷(响应体中的data部分进入后续处理)
        const payload = response.data
        if (payload.code === 200) {
            return payload.data
        }

        return Promise.reject(payload)
    },
    (error) => {
        return Promise.reject(error)
    }
)

/**
 * 经响应拦截器解包后的axios实例: 各请求方法直接resolve出后端payload.data(而非AxiosResponse整体)
 * 此处把返回类型收窄为Promise<any>,最终数据类型交由各API函数自己的@return标注
 * @typedef {Object} HttpClient
 * @property {(url: String, config?: import('axios').AxiosRequestConfig) => Promise<any>} get
 * @property {(url: String, data?: any, config?: import('axios').AxiosRequestConfig) => Promise<any>} post
 * @property {(url: String, data?: any, config?: import('axios').AxiosRequestConfig) => Promise<any>} put
 * @property {(url: String, config?: import('axios').AxiosRequestConfig) => Promise<any>} delete
 * @property {(url: String, data?: any, config?: import('axios').AxiosRequestConfig) => Promise<any>} patch
 * */

export default /** @type {HttpClient} */ (axiosInstance)