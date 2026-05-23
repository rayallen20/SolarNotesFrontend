<template>
<div class="panel-list">
    <ul class="flex-wrap">
        <li class="flex-item" v-for="index in 8" :key="index">
            <Trapezoid></Trapezoid>
            <RouterLink :to="{name: 'article'}" class="link">一些文字</RouterLink>
        </li>
    </ul>
</div>
</template>
<script setup>
import Trapezoid from "@/components/common/Trapezoid.vue";
import LuminousAction from "@/components/common/LuminousAction.vue";
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