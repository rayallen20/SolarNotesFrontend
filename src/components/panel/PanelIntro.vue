<template>
<div class="panel-intro">
    <!-- 标题开始 -->
    <h2>网络安全管理</h2>
    <!-- 标题结束 -->

    <!-- 分割线开始 -->
    <CutOffLine class="divider"></CutOffLine>
    <!-- 分割线结束 -->

    <!-- 段落开始 -->
    <p>
        150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.
        150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.
        150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内
    </p>
    <!-- 段落结束 -->
</div>
</template>

<script setup>
import CutOffLine from "@/components/common/CutOffLine.vue";

defineOptions({
    name: 'PanelIntro',
})
</script>

<style scoped>
.panel-intro {
    width: 70%;
    margin-bottom: 70px;
}

.panel-intro h2 {
    margin-bottom: 16px;
    font-size: 40px;
    font-style: normal;
    font-weight: 900;
    line-height: 40px;
    letter-spacing: 2px;
}

.panel-intro .divider {
    margin-bottom: 16px;
}

.panel-intro p {
    max-height: 160px;
    overflow: hidden;
    font-size: 18px;
    font-style: normal;
    font-weight: 400;
    line-height: 32px;
    letter-spacing: 1px;
}
</style>