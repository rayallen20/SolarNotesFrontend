import {useFocusStore} from "@/stores/focus.js";
import {useBookStore} from "@/stores/book.js";
import {watch} from "vue";
import {getList} from "@/api/book.js";

/**
 * 本函数用于根据当前聚焦的天体,请求该天体对应的书籍列表
 *      - 监听聚焦天体(focusStore.focusedEntity)和重试信号(bookStore.reloadNonce)的变化
 *      - 聚焦天体时: 请求书籍列表API,并写入bookStore.bookList
 *      - 退出聚焦: 清空bookStore.bookList
 * 本函数在SolarCanvas组件中调用1次即可,因为watch()是随组件作用域自动回收的,不需要手动停止
 * */
export function useBookListSync() {
    const focusStore = useFocusStore()
    const bookStore = useBookStore()

    watch(
        [
            () => focusStore.focusedEntity,
            () => bookStore.reloadNonce,
        ],
        async (newValues) => {
            const entity = newValues[0]

            // 退出聚焦: 清空书籍列表
            if (entity === null) {
                bookStore.clear()
                return
            }

            // 切换聚焦天体/重试: 清除之前的书籍列表,进入loading状态,然后再次请求API
            bookStore.startLoading()
            try {
                const {bookList} = await getList(entity.userData.id)
                // 竟态条件: await期间镜头可能不再聚焦在entity上,因此仅在镜头仍聚焦在entity上时,才写入bookStore
                if (focusStore.focusedEntity === entity) {
                    bookStore.setBookList(bookList)
                }
            } catch (err) {
                console.error('请求书籍列表API失败:', err)
                if (focusStore.focusedEntity === entity) {
                    bookStore.markFailed()
                }
            }
        }
    )
}