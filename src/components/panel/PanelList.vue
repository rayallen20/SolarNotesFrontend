<template>
<div class="panel-list">
    <!-- 加载失败: 点击重试 -->
    <div v-if="bookStore.status === RequestStatus.failed" class="load-error">
        <span>加载失败</span>
        <button type="button" class="retry" @click="bookStore.requestReload()">重试</button>
    </div>

    <!-- 否则即为加载成功(即使书籍列表API返回的是一个空的list) -->
    <ul v-else class="flex-wrap">
        <li class="flex-item" v-for="book in bookStore.bookList" :key="book.id">
            <Trapezoid></Trapezoid>
            <RouterLink
                :to="{name: 'article', params: {id: book.id}}"
                class="link"
            >
                {{book.title}}
            </RouterLink>
        </li>
    </ul>
</div>
</template>
<script setup>
import Trapezoid from "@/components/common/Trapezoid.vue";
import {useBookStore} from "@/stores/book.js";
import {RequestStatus} from "@/lib/enum.js";

/**
 * @type {import('@/stores/book.js').BookStore} 书籍列表状态机store实例
 * */
const bookStore = useBookStore()
</script>

<style scoped>
.panel-list {
    --gap: 70px;
}

.panel-list {
    width: 100%;
    height: 306px;
    margin-bottom: 40px;
}

/* 加载失败提示 */
.panel-list .load-error {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    row-gap: 16px;
    color: #CFE8FF;
}

.panel-list .load-error .retry {
    padding: 6px 20px;
    font-size: 16px;
    color: #CFE8FF;
    background: transparent;
    border: 1px solid rgba(32, 198, 216, 0.35);
    border-radius: 8px;
    cursor: pointer;
    transition: 0.2s;
}

.panel-list .load-error .retry:hover {
    color: #51EEFF;
    border-color: #51EEFF;
}

.panel-list .flex-wrap {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: space-between;
    /* 当条目多了时可以使用align-content 如果条目少的话考虑使用row-gap */
    align-content: space-between;
    flex-wrap: wrap;
}

.panel-list .flex-wrap .flex-item {
    display: flex;
    column-gap: 16px;
    /* 间距70px 每行固定显示2个弹性条目 */
    flex: 0 0 calc((100% - var(--gap)) / 2);
}

/* 窄屏的情况下每行显示1个 */
@media (max-width: 768px) {
    .panel-list .flex-wrap .flex-item {
        flex-basis: 100%;
    }
}

.panel-list .flex-wrap .flex-item .link {
    font-size: 24px;
    font-style: normal;
    font-weight: 700;
    line-height: 33px;
    letter-spacing: 1px;
    transition: 0.2s;
}

.panel-list .flex-wrap .flex-item .link:hover {
    color: #51EEFF;
}
</style>