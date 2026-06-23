import {defineStore} from "pinia";
import {computed, ref, shallowRef} from "vue";
import {RequestStatus} from "@/lib/enum.js";
import {renderMarkdownToHtml} from "@/lib/markdown.js";

/**
 * @typedef {import('@/api/article.js').Article} Article
 * */

export const useArticleStore = defineStore('article', () => {
    // PART1. state
    /**
     * @type {import('vue').ShallowRef<Article|null>} 当前选中的叶子节点对应的文章对象
     * Tips: 文章对象没有逐字段修改的需求,故使用ShallowRef而非Ref
     * */
    const article = shallowRef(null)

    /**
     * @type {import('vue').Ref<String>} 获取文章API的请求状态 (初态为loading,因为渲染前watch必须调用startLoading)
     * */
    const status = ref(RequestStatus.loading)

    /**
     * @type {import('vue').Ref<Number>} 重试信号 该信号自增,以便重新触发useArticleSync中的请求
     * */
    const reloadNonce = ref(0)

    // PART2. computed
    /**
     * @type {import('vue').ComputedRef<String>} 文章正文md文档对应的安全HTML表达
     * */
    const articleHtml = computed(() => {
        if (article.value === null) {
            return ''
        }

        return renderMarkdownToHtml(article.value.content)
    })

    // PART3. mutations/actions
    /**
     * 本函数用于选中叶子节点/重试时调用,清空之前的文章内容并进入loading状态
     * */
    function startLoading() {
        article.value = null
        status.value = RequestStatus.loading
    }

    /**
     * 本函数用于请求获取文章API成功后调用,写入文章对象并标记请求成功
     * @param {Article} fetchedArticle 后端返回的文章对象
     * */
    function setArticle(fetchedArticle) {
        article.value = fetchedArticle
        status.value = RequestStatus.success
    }

    /**
     * 本函数用于请求获取文章API失败后调用,清空文章并标记失败
     * */
    function markFailed() {
        article.value = null
        status.value = RequestStatus.failed
    }

    /**
     * 本函数用于重试时调用,自增重试信号以便触发useArticleSync使用当前叶子节点id重新请求API
     * */
    function requestReload() {
        reloadNonce.value++
    }

    return {
        // state
        article, status, reloadNonce,

        // computed
        articleHtml,

        // mutations/actions
        startLoading, setArticle, markFailed, requestReload,
    }
})

/**
 * @typedef {ReturnType<typeof useArticleStore>} ArticleStore 文章状态机存储实例
 * */