<template>
<div class="solar-panel">
    <div class="content-warp">
        <PanelIntro></PanelIntro>
        <PanelList></PanelList>
        <LuminousAction :type="ActionType.link"></LuminousAction>
    </div>
</div>
</template>

<script setup>
import PanelIntro from '@/components/panel/PanelIntro.vue'
import PanelList from "@/components/panel/PanelList.vue";
import LuminousAction from "@/components/common/LuminousAction.vue";
import {ActionType} from "@/lib/enum.js";

defineOptions({
    name: 'SolarPanel',
})
</script>

<style scoped>
.solar-panel {
    position: fixed;
    left: 0;
    top: 0;
    /* panel层在label层上方(其实二者并不会同时出现) */
    z-index: 40;

    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
    /* Tips: 这里要和状态机中配置的动画时间相同 */
    transition: transform 0.6s ease, opacity 0.6s ease;
    will-change: transform, opacity;

    width: 60%;
    height: 100vh;
    background: linear-gradient(90deg, rgba(5, 9, 18, 0.90) 0%, rgba(5, 9, 18, 0.40) 49.98%, rgba(5, 9, 18, 0.90) 99.97%);
    padding: 149px 0 240px 132px;
}

/* 打开panel: 向左移动,移入到屏幕内 */
.solar-panel.open {
    transform: translateX(0);
    opacity: 1;
    pointer-events: auto;
}

/* 关闭panel: 向右移动,移出屏幕直到消失 */
.solar-panel.close {
    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
}

.solar-panel .content-warp {
    width: 100%;
    height: 100%;
    font-family: "Source Han Serif CN", serif;
    color: #FFFFFF;
}
</style>