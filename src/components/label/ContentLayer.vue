<template>
    <div class="content-layer">
        <!-- 内容区域开始 -->
        <div class="content">
            <h2>网络安全管理</h2>
            <div class="cut-off-line"></div>
            <p>
                150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.
                150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.
                150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内容.150字之内的内
            </p>
        </div>
        <!-- 内容区域结束 -->

        <!-- 底部按钮区域开始 -->
        <LuminousAction :type="ActionType.button" class="bottom-button"></LuminousAction>
        <!-- 底部按钮区域结束 -->
    </div>
</template>

<script setup>
import LuminousAction from "@/components/common/LuminousAction.vue";
import {ActionType} from "@/lib/enum.js";

defineOptions({
    name: 'ContentLayer',
})
</script>

<style scoped>
/* 内容层开始 */
.content-layer {
    position: absolute;
    inset: 0;
    /* 内容层在最上方 可以遮挡边框层和装饰层 */
    z-index: 30;
}
/* 内容层结束 */

/* 内容区域开始 */
.content-layer .content {
    position: absolute;
    width: 383px;
    height: 200px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: #ffffff;
}

.content-layer .content h2 {
    margin-bottom: 10px;
    font-size: 20px;
    font-style: normal;
    font-weight: 900;
    line-height: 20px;
    letter-spacing: 1px;
}

.content-layer .content .cut-off-line {
    margin-bottom: 10px;
    width: 60px;
    height: 3px;
    /* 从左到右 由暗到亮 */
    background: linear-gradient(
        90deg,
        rgba(32, 198, 216, 0.4) 0%,
        rgba(32, 198, 216, 1) 100%
    );
    clip-path: polygon(
        6px 0,
        60px 0,
        54px 3px,
        0 3px
    );
}

.content-layer .content p {
    width: 100%;
    height: 154px;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 22px;
    letter-spacing: 1px;
}

.content-layer .bottom-button {
    position: absolute;
    left: calc(var(--btn-center-x) - var(--btn-width) / 2);
    bottom: 0;
}
/* 内容区域结束 */
</style>