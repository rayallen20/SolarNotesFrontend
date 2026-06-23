import {useCatalogueStore} from "@/stores/reader/catalogue.js";
import {useArticleStore} from "@/stores/reader/article.js";
import {watch} from "vue";
import {getArticle} from "@/api/article.js";

/**
 * 本函数用于根据当前选中的叶子节点id,请求该叶子节点对应的md文档正文
 *      - 监听CatalogueStore.activeLeafId和ArticleStore.reloadNonce,二者任意一个发生变化时,都会触发重新请求API
 *      - activeLeafId为null时,表示(选中的是非叶节点/目录响应未达),此时不发送获取文章请求
 *      - 不使用immediate: 挂载时activeLeafId必然为null,activeLeafId仅在用户点击后才会出现有效值,因此普通watch即可
 *      - 本函数在ArticleReader组件中调用1次即可.watch随组件作用域自动回收,无需手动停止
 * */
export function useArticleSync() {
    const catalogueStore = useCatalogueStore()
    const articleStore = useArticleStore()

    watch(
        [
            () => catalogueStore.activeLeafId,
            () => articleStore.reloadNonce,
        ],
        async (newValues) => {
            const leafId = newValues[0]

            // 选中非叶节点或获取目录API响应未达时,不发送获取文章请求
            if (leafId === null) {
                return
            }

            // 进入loading状态 重新请求API
            articleStore.startLoading()
            try {
                const {article} = await getArticle(leafId)
                // 竟态条件: 在await期间,选中的叶子节点id可能已经被切换,仅在activeLeafId仍为请求时使用的值时才写入
                if (catalogueStore.activeLeafId === leafId) {
                    articleStore.setArticle(article)
                }
            } catch (err) {
                console.error('请求获取文章API失败', err)
                if (catalogueStore.activeLeafId === leafId) {
                    articleStore.markFailed()
                }
            }
        },
    )
}