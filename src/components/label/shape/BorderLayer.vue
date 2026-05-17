<template>
    <div class="border-layer">
        <!-- 顶部线开始 -->
        <div class="top-line">
            <svg class="top-svg" viewBox="0 0 426 17" preserveAspectRatio="none">
                <defs>
                    <!-- 顶部色带的 暗 -> 半透明 -> 暗 填充渐变 -->
                    <linearGradient
                        id="bg-grad-top"
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        y1="0"
                        x2="426"
                        y2="0">
                        <stop offset="0%" stop-color="rgb(5,9,18)" stop-opacity="0.90"/>
                        <stop offset="49.98%" stop-color="rgb(5,9,18)" stop-opacity="0.40"/>
                        <stop offset="99.97%" stop-color="rgb(5,9,18)" stop-opacity="0.90"/>
                    </linearGradient>

                    <!-- 线条的 亮 -> 暗 -> 亮 线性渐变 -->
                    <linearGradient
                        id="stroke-grad-top"
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        y1="0"
                        x2="426"
                        y2="0">
                        <stop offset="0%" stop-color="#51BCFF" stop-opacity="1"/>
                        <stop offset="49.98%" stop-color="#51BCFF" stop-opacity="0.1"/>
                        <stop offset="99.97%" stop-color="#51BCFF" stop-opacity="1"/>
                    </linearGradient>
                </defs>

                <!-- 1. 背景暗色带: 高度2px,紧贴顶部的按色带 -->
                <rect
                    x="0"
                    y="0"
                    width="426"
                    height="2"
                    fill="url(#bg-grad-top)"
                >
                </rect>

                <!-- 2. 顶部线条系统 -->
                <!--
                    2.1 左直线: (0, 0.5) -> (60, 0.5)
                    Tips: 因为线是水平居中的,也就是上下各占0.5px,所以y坐标要+0.5
                -->
                <path
                    d="M0 0.5 H60"
                    stroke="url(#stroke-grad-top)"
                    stroke-width="1"
                    fill="none"
                    stroke-linecap="butt"
                    shape-rendering="crispEdges"
                ></path>

                <!--
                    2.2 凹口: 右斜下 -> 水平 -> 右斜上
                    (60, 0.5) -> (108, 16.5) -> (318, 16.5) -> (366, 0.5)
                -->
                <path
                    d="M60 0.5 L108 16.5 H318 L366 0.5"
                    stroke="url(#stroke-grad-top)"
                    stroke-width="1"
                    fill="none"
                    stroke-linecap="butt"
                    shape-rendering="crispEdges"
                >
                </path>

                <!-- 2.3 右直线: (366, 0.5) -> (426, 0.5) -->
                <path
                    d="M366 0.5 H426"
                    stroke="url(#stroke-grad-top)"
                    stroke-width="1"
                    fill="none"
                    stroke-linecap="butt"
                    shape-rendering="crispEdges"
                >
                </path>
            </svg>
        </div>
        <!-- 顶部线结束 -->

        <!-- 底部线开始 -->
        <div class="bottom-line">
            <svg class="bottom-svg" viewBox="0 0 426 17" preserveAspectRatio="none">
                <defs>
                    <!-- 底部色带的 暗 -> 半透明 -> 暗 填充渐变 -->
                    <linearGradient
                        id="bg-grad-bottom"
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        y1="0"
                        x2="426"
                        y2="0"
                    >
                        <stop offset="0%" stop-color="rgb(5,9,18)" stop-opacity="0.90"/>
                        <stop offset="49.98%" stop-color="rgb(5,9,18)" stop-opacity="0.40"/>
                        <stop offset="99.97%" stop-color="rgb(5,9,18)" stop-opacity="0.90"/>
                    </linearGradient>

                    <!-- 线条的 亮 -> 暗 -> 亮 线性渐变 -->
                    <linearGradient
                        id="stroke-grad-bottom"
                        gradientUnits="userSpaceOnUse"
                        x1="0"
                        y1="0"
                        x2="426"
                        y2="0"
                    >
                        <stop offset="0%" stop-color="#51BCFF" stop-opacity="1"/>
                        <stop offset="49.98%" stop-color="#51BCFF" stop-opacity="0.1"/>
                        <stop offset="99.97%" stop-color="#51BCFF" stop-opacity="1"/>
                    </linearGradient>
                </defs>

                <!-- 1. 背景暗色带 -->
                <rect
                    x="0"
                    y="15"
                    width="426"
                    height="2"
                    fill="url(#bg-grad-bottom)">
                </rect>

                <!-- 2. 底部线条系统 -->
                <!-- 2.1 左直线: (0, 16.5) -> (60, 16.5) -->
                <path
                    d="M0 16.5 H60"
                    stroke="url(#stroke-grad-bottom)"
                    stroke-width="1"
                    fill="none"
                    stroke-linecap="butt"
                    shape-rendering="crispEdges"
                >
                </path>

                <!--
                    2.2 凹口(2段): 右斜上 -> 右水平 + 右水平 -> 右斜下
                    (60,16.5) -> (108,0.5) -> (140,0.5) + (286,0.5) -> (318, 0.5) -> (366,16.5)
                    Tips: 这里分成2段是因为中间还有按钮
                -->
                <!-- 2.2.1 右斜上 -> 右水平: (60,16.5) -> (108,0.5) -> (140,0.5) -->
                <path
                    d="M60 16.5 L108 0.5 H140"
                    stroke="url(#stroke-grad-bottom)"
                    stroke-width="1"
                    fill="none"
                    stroke-linecap="butt"
                    shape-rendering="crispEdges"
                >
                </path>

                <!-- 2.2.2 右水平 -> 右斜下: (286,0.5) -> (318, 0.5) -> (366,16.5) -->
                <path
                    d="M286 0.5 H318 L366 16.5"
                    stroke="url(#stroke-grad-bottom)"
                    stroke-width="1"
                    fill="none"
                    stroke-linecap="butt"
                    shape-rendering="crispEdges"
                >
                </path>

                <!-- 2.3 右直线: (366, 16.5) -> (426, 16.5）-->
                <path
                    d="M366 16.5 H426"
                    stroke="url(#stroke-grad-bottom)"
                    stroke-width="1"
                    fill="none"
                    stroke-linecap="butt"
                    shape-rendering="crispEdges"
                >
                </path>
            </svg>
        </div>
        <!-- 底部线结束 -->

        <!-- 左侧轨道区域开始 -->
        <div class="left-rail">
            <!-- 左上边框 -->
            <div class="seg top"></div>

            <!-- 左中边框 -->
            <div class="seg middle"></div>

            <!-- 左下边框 -->
            <div class="seg bottom"></div>
        </div>
        <!-- 左侧轨道区域结束 -->
    </div>
</template>

<script setup>
defineOptions({
    name: 'BorderLayer',
})
</script>

<style scoped>
/* 边框层开始 */
.border-layer {
    position: absolute;
    inset: 0;
    /* 边框层在最底部 */
    z-index: 10;
}
/* 边框层结束 */

/* 顶部线&底部线开始 */
.border-layer .top-line,
.border-layer .bottom-line {
    position: absolute;
    left: 0;
    right: 0;
    /* 需要容纳向下折的 16px */
    height: 17px;
    /* 避免影响交互 */
    pointer-events: none;
}

.border-layer .top-line {
    top: 0;
}

.border-layer .bottom-line {
    bottom: 0;
}

.border-layer .top-line .top-svg,
.border-layer .bottom-line .bottom-svg {
    display: block;
    width: 100%;
    height: 100%;
}
/* 顶部线&底部线结束 */

/* 左侧轨道区域开始 */
.border-layer .left-rail {
    /*
    left-rail用于组织左侧上/中/下这3个不同粗细的边框.为left-rail设置绝对定位
    是为了让其子元素能够以left-rail作为局部坐标系
    */
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--left-rail-width);
}

.seg {
    position: absolute;
    background-image: var(--vertical-grad);
    background-size: 100% var(--height);
    background-repeat: no-repeat;
}

.border-layer .left-rail .top {
    top: 0;
    left: 0;
    width: var(--left-rail-top-width);
    height: var(--left-rail-top-height);
    background-position: 0 0;
}

.border-layer .left-rail .middle {
    top: var(--left-rail-top-height);
    /* 细线是在粗线内侧的 */
    right: 0;
    width: var(--left-rail-middle-width);
    height: var(--left-rail-middle-height);
    background-position: 0 calc(-1 * var(--left-rail-top-height));
}

.border-layer .left-rail .bottom {
    bottom: 0;
    left: 0;
    width: var(--left-rail-bottom-width);
    height: var(--left-rail-bottom-height);
    background-position: 0 calc(-1 * (var(--height) - var(--left-rail-bottom-height)));
}
/* 左侧轨道区域结束 */
</style>