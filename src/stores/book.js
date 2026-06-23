import {defineStore} from "pinia";
import {ref} from "vue";
import {RequestStatus} from "@/lib/enum.js";

/**
 * @typedef {Object} BookItem 后端获取书籍列表接口返回的书籍项对象
 * @property {String} id 书籍id(用于后续请求文章详情使用)
 * @property {String} title 书籍标题(渲染在PanelList组件的li上)
 * */

export const useBookStore = defineStore('book', () => {
    // state
    /**
     * @type {import('vue').Ref<Array<BookItem>>} 当前聚焦天体的书籍列表
     * */
    const bookList = ref([])

    /**
     * @type {import('vue').Ref<String>} API请求状态
     * */
    const status = ref(RequestStatus.success)

    /**
     * @type {import('vue').Ref<Number>} 重试信号 该信号自增,以便重新触发useBookListSync中的请求
     * */
    const reloadNonce = ref(0)

    // mutations/actions
    /**
     * 本函数用于切换聚焦天体/重试时调用,清除之前的天体书籍列表并进入loading状态
     * */
    function startLoading() {
        bookList.value = []
        status.value = RequestStatus.loading
    }

    /**
     * 本函数用于书籍列表API请求成功时调用
     * @param {Array<BookItem>} list 后端返回的书籍列表
     * */
    function setBookList(list) {
        bookList.value = list
        status.value = RequestStatus.success
    }

    /**
     * 本函数用于书籍列表API请求失败时调用,清空之前的天体书籍列表并标记失败
     * */
    function markFailed() {
        bookList.value = []
        status.value = RequestStatus.failed
    }

    /**
     * 本函数用于退出聚焦时调用,清空之前的天体书籍列表并复位状态为初态
     * */
    function clear() {
        bookList.value = []
        status.value = RequestStatus.success
    }

    /**
     * 本函数用于重试时调用,自增重试信号,触发useBookListSync使用当前聚焦天体重新拉取
     * */
    function requestReload() {
        reloadNonce.value++
    }

    return {
        // state
        bookList, status, reloadNonce,
        // mutations/actions
        startLoading, setBookList, markFailed, clear, requestReload,
    }
})

/**
 * @typedef {ReturnType<typeof useBookStore>} BookStore 书籍列表状态机的store实例
 * */