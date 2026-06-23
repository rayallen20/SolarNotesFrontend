<template>
    <div class="header-bar">
        <RouterLink :to="{name: 'solar'}" class="return-link">
            <span class="iconfont icon-icon-left"></span>
            <span class="literal">返回太阳系</span>
        </RouterLink>

        <h2>{{catalogueStore.breadcrumb}}</h2>
    </div>
</template>

<script setup>
import {useCatalogueStore} from "@/stores/reader/catalogue.js";

defineOptions({
    name: 'HeaderBar',
})

/**
 * @type {import('@/stores/reader/catalogue.js').CatalogueStore} 目录状态机实例
 * */
const catalogueStore = useCatalogueStore()
</script>

<style scoped>
.header-bar {
    flex: 0 0 100px;
    display: flex;
    column-gap: 54px;
    border-bottom: 2px solid #21AAFF;
    background: rgba(0, 0, 0, 0.40);
}

.header-bar .return-link {
    position: relative;
    background: transparent;
    display: flex;
    align-items: center;
    padding-left: 30px;
    height: 100%;
    transition: all 0.4s;
}

/* 悬停时无法过渡background属性,故使用伪元素实现悬停background渐变过渡 */
.header-bar .return-link::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(44, 251, 255, 0.10) 0%, rgba(44, 251, 255, 0.00) 100%);
    opacity: 0.33333;
    transition: opacity 0.5s ease;
}

.header-bar .return-link:hover::before {
    opacity: 1;
}

.header-bar .return-link span {
    color: #2CFBFF;
}

.header-bar .return-link .icon-icon-left {
    font-size: 18px;
}

.header-bar .return-link .literal {
    font-family: "PingFang SC", serif;
    font-size: 18px;
    font-style: normal;
    letter-spacing: 1px;
}

.header-bar h2 {
    height: 100%;
    display: flex;
    align-items: center;
    color: #FFFFFF;
    font-size: 40px;
    font-style: normal;
    font-weight: 900;
    letter-spacing: 2px;
}
</style>