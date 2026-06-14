<template>
    <div class="content-layer">
        <!-- 内容区域开始 -->
        <div class="content">
            <h2>{{labelTextSnapshot !== null ? labelTextSnapshot.title : ''}}</h2>
            <CutOffLine class="divider"></CutOffLine>
            <p>
                {{labelTextSnapshot !== null ? labelTextSnapshot.intro : ''}}
            </p>
        </div>
        <!-- 内容区域结束 -->

        <!-- 底部按钮区域开始 -->
        <LuminousAction
            :type="ActionType.button"
            class="bottom-button"
            @click="onFocusClick"
        ></LuminousAction>
        <!-- 底部按钮区域结束 -->
    </div>
</template>

<script setup>
import LuminousAction from "@/components/common/LuminousAction.vue";
import {ActionType} from "@/lib/enum.js";
import {useHoverStore} from "@/stores/hover.js";
import {ref, watch} from "vue";
import CutOffLine from "@/components/common/CutOffLine.vue";
import {useFocusStore} from "@/stores/focus.js";

defineOptions({
    name: 'ContentLayer',
})

/**
 * @type {import('@/stores/hover.js').HoverStore} 悬停状态机的store实例
 * */
const hoverStore = useHoverStore()

/**
 * @type {import('@/stores/focus.js').FocusStore} 聚焦状态机的store实例
 * */
const focusStore = useFocusStore()

/**
 * @type {import('vue').Ref<import('@/stores/hover.js').LabelText|null>} label文本的本地快照
 * 目的: 让label淡出动画期间(即opacity从1变为0的0.5s)文字保持不变,而不是随activeEntity变为null而立即清空,
 *      否则会出现"文字先消失,容器再淡掉"的视觉效果,这种体验非常差
 *
 * 更新规则:
 *      - hoverStore.labelText变为非null(状态机变更状态为body/sticky/label时): 同步到本变量
 *      - hoverStore.labelText变为null(状态机变更状态为idle时): 不更新本变量,继续持有上一个天体的内容,
 *                                                          直到下一次有非null值到来
 * */
const labelTextSnapshot = ref(null)

watch(
    () => hoverStore.labelText,
    (newVal) => {
        if (newVal !== null) {
            labelTextSnapshot.value = newVal
        }
    },
    {
        immediate: true
    },
)

/**
 * 本函数用于处理按钮的点击回调
 * @param {PointerEvent} event click事件对象
 * 函数内的操作:
 *      1. 聚焦到当前锚点对象
 *      2. 立即隐藏label
 * */
function onFocusClick(event) {
    const anchor = hoverStore.activeEntity
    if (anchor === null) {
        return
    }

    focusStore.requestFocus(anchor)
    hoverStore.enterIdle()
}
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

.content-layer .content .divider {
    margin-bottom: 10px;
}

.content-layer .content p {
    width: 100%;
    height: 154px;
    font-size: 14px;
    font-style: normal;
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