import {useRoute} from "vue-router";
import {useCatalogueStore} from "@/stores/reader/catalogue.js";
import {watch} from "vue";
import {getCatalogue} from "@/api/catalogue.js";

/**
 * 本函数用于根据当前路由中的书籍id,请求该书籍的目录树
 *      - 本函数监听路由中书籍id和存储中重试信号(catalogueStore.reloadNonce)的变化,当二者中任意一个发生变化时将重新请求API
 *      - id存在时: 请求获取目录API,并写入catalogueStore
 *      - 本函数在ArticleReader组件中调用1次即可,watch随组件作用域自动回收,不需要手动停止
 * */
export function useCatalogueSync() {
    const route= useRoute()
    const catalogueStore = useCatalogueStore()

    watch(
        [
            () => route.params.id,
            () => catalogueStore.reloadNonce,
        ],
        async (newValues) => {
            const bookId = newValues[0]

            // 离开文章页时,route.params.id会变为undefined,此时不再需要发送请求
            if (bookId === undefined) {
                return
            }

            // 进入loading状态,重新请求API
            catalogueStore.startLoading()
            try {
                const {catalogue} = await getCatalogue(Number(bookId))
                // 竟态条件: 在await期间,路由可能已经切换,因此仅在路由中参数仍为请求时使用的值时,才写入catalogueStore
                if (route.params.id === bookId) {
                    catalogueStore.setCatalogue(catalogue)
                }
            } catch (err) {
                console.error('请求获取目录API失败', err)
                if (route.params.id === bookId) {
                    catalogueStore.markFailed()
                }
            }
        },
        {
            immediate: true,
        }
    )
}