<template>
    <Transition name="scene-error-fade">
        <div
            v-if="visible"
            class="scene-error-hint"
            role="alert"
        >
            <p class="text">太阳系场景加载失败,请刷新页面后重试</p>

            <button class="close" aria-label="关闭" @click="$emit('close')">
                <i class="iconfont icon-a-closeicon-close" aria-hidden="true"></i>
            </button>
        </div>
    </Transition>
</template>

<script setup>
defineOptions({
    name: 'SceneErrorHint',
})

defineProps({
    visible: {
        type: Boolean,
        default: false,
    }
})

defineEmits([
    'close',
])
</script>

<style scoped>
.scene-error-hint {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: 8px;
    /* 背景色与模糊和KeyboardHint一致 */
    background: rgba(10, 22, 34, 0.25);
    backdrop-filter: blur(4px);
    /* 描边使用暖色,暗示错误 */
    border: 1px solid rgba(255, 138, 128, 0.45);
    color: #FFD9D4;
    font-size: 14px;
    line-height: 1;
    user-select: none;
}

.scene-error-hint .text {
    margin: 0;
}

.scene-error-hint .close {
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

.scene-error-hint .close:hover {
    opacity: 1;
}

.scene-error-hint .close .icon-a-closeicon-close {
    /* 覆盖 .iconfont 自带的 16px */
    font-size: 16px;
    cursor: url("@/assets/cursors/cursor-pointer.png") 12 0, pointer;
}

.scene-error-fade-enter-active, .scene-error-fade-leave-active {
    transition: opacity 0.4s ease;
}

.scene-error-fade-enter-from, .scene-error-fade-leave-to {
    opacity: 0;
}
</style>