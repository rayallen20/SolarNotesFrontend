<template>
    <Transition name="hint-fade">
        <div
            v-if="visible"
            class="keyboard-hint"
            role="status"
        >
            <p class="text">
                <kbd>←</kbd>

                <kbd>→</kbd>

                聚焦&nbsp;/&nbsp;切换天体

                <span class="separator">·</span>

                <kbd>Esc</kbd>

                取消聚焦
            </p>

            <button class="dismiss" @click="dismiss">不再提示</button>

            <button class="close" aria-label="关闭" @click="close">
                <i class="iconfont icon-a-closeicon-close" aria-hidden="true"></i>
            </button>
        </div>
    </Transition>
</template>

<script setup>
import {onMounted, ref} from "vue";

defineOptions({
    name: 'KeyboardHint',
})

/**
 * @type {String} 存储key名
 * */
const STORAGE_KEY = 'solarNotes:hideKeyboardHint'

/**
 * @type {String} 确认不再显示时存储的value
 * */
const IS_HIDDEN = 'hidden'

/**
 * @type {import('vue').Ref<Boolean>} 提示层可见状态
 * */
const visible = ref(false)

onMounted(() => {
    // 若localStorage不可用,则默认显示
    let hidden = false
    try {
        hidden = localStorage.getItem(STORAGE_KEY) === IS_HIDDEN
    } catch {
        hidden = false
    }

    visible.value = !hidden
})

/**
 * 本函数用于仅在本次会话关闭提示层
 * */
function close() {
    visible.value = false
}

function dismiss() {
    try {
        localStorage.setItem(STORAGE_KEY, IS_HIDDEN)
    } catch {
        // 若localStorage不可用,则无法存储用户选择,但不影响提示层的关闭
    }

    visible.value = false
}
</script>

<style scoped>
.keyboard-hint {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 24px;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(10, 22, 34, 0.72);
    border: 1px solid rgba(32, 198, 216, 0.35);
    color: #CFE8FF;
    font-size: 13px;
    line-height: 1;
    backdrop-filter: blur(6px);
    user-select: none;
}

.keyboard-hint .text {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.keyboard-hint .text kbd {
    padding: 2px 7px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
}

.keyboard-hint .text .separator {
    opacity: 0.5;
}

.keyboard-hint .dismiss {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 4px;
    color: inherit;
    padding: 4px 10px;
    white-space: nowrap;
}

.keyboard-hint .dismiss:hover {
    background: rgba(255, 255, 255, 0.12);
}

.keyboard-hint .close {
    background: transparent;
    border: none;
    color: inherit;
    opacity: 0.6;
    line-height: 1;
    padding: 0 2px;
    /* 图标在按钮内垂直居中 */
    display: inline-flex;
    align-items: center;
}

.keyboard-hint .close:hover {
    opacity: 1;
}

.keyboard-hint .close .icon-a-closeicon-close {
    /* 覆盖.iconfont自带的16px,调整字体图标大小 */
    font-size: 16px;
    /* 修改鼠标样式 */
    cursor: url("@/assets/cursors/cursor-pointer.png") 12 0, pointer;
}

.hint-fade-enter-active, .hint-fade-leave-active {
    transition: opacity 0.4s ease;
}

.hint-fade-enter-from, .hint-fade-leave-to {
    opacity: 0;
}
</style>