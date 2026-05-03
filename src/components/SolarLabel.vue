<template>
    <div class="solar-label">
        <!-- 裁剪区域开始 -->
        <div class="label-shape">
            <!-- 边框层开始 -->
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
            <!-- 边框层结束 -->

            <!-- 内部装饰层开始 -->
            <!-- Tips: 这里的内部是指装饰件在裁剪区域内部 -->
            <div class="inner-decor-layer">
                <!-- 左侧竖梯形开始 -->
                <Trapezoid class="left"></Trapezoid>
                <!-- 左侧竖梯形结束 -->
            </div>
            <!-- 内部装饰层结束 -->
        </div>
        <!-- 裁剪区域结束 -->

        <!-- 外部装饰件层开始 -->
        <!-- Tips: 这里的外部是指装饰件在裁剪区域的外部 -->
        <div class="outer-decor-layer">
            <!-- 左侧小矩形开始 -->
            <div class="seg rectangle"></div>
            <!-- 左侧小矩形结束 -->

            <!-- 右边框开始 -->
            <div class="right-rail"></div>
            <!-- 右边框结束 -->

            <!-- 斜纹条开始 -->
            <div class="stripe-chip">
                <!-- 平行四边形开始 -->
                <div
                    class="stripe"
                    v-for="n in 6"
                    :key="n"
                    :style="`--i: ${n - 1}`">
                </div>
                <!-- 平行四边形结束 -->
            </div>
            <!-- 斜纹条结束 -->
        </div>
        <!-- 外部装饰件层结束 -->

        <!-- 内容层开始 -->
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
            <LuminousButton :usage="usage" class="bottom-button"></LuminousButton>
            <!-- 底部按钮区域结束 -->
        </div>
        <!-- 内容层结束 -->
    </div>
</template>

<script setup>
import Trapezoid from "@/components/common/Trapezoid.vue";
import LuminousButton from "@/components/common/LuminousButton.vue";

defineOptions({
    name: 'SolarLabel',
})

const usage = 'button'
</script>

<style scoped>
/* 定义变量 */
.solar-label {
    /* label宽度 */
    --width: 426px;
    /* label高度 */
    --height: 286px;

    /* 折线相关配置 */
    /* 折线起点的水平位置 */
    --notch-start-x: 60px;
    /* 折线凹口深度 */
    --notch-depth: 16px;
    /* 折线斜边水平距离 Tips: run有延伸的意思 */
    --notch-run-x: 48px;
    /* 折线中水平线的宽度 = label宽度 - 起点水平位置 * 2 - 折线斜边水平距离 * 2 */
    --notch-horizontal-width: calc(var(--width) - var(--notch-start-x) * 2 - var(--notch-run-x) * 2);

    /* 按钮相关配置 */
    --btn-width: 146px;
    /* 按钮中心点的水平位置 */
    --btn-center-x: 213px;

    /* 左侧轨道区域相关配置 */
    /* 左侧轨道宽度 */
    --left-rail-width: 3px;
    /* 左侧轨道上边框宽度 */
    --left-rail-top-width: 3px;
    /* 左侧轨道上边框高度 */
    --left-rail-top-height: 162px;
    /* 左侧轨道中边框宽度 */
    --left-rail-middle-width: 1px;
    /* 左侧轨道中边框高度 */
    --left-rail-middle-height: 53px;
    /* 左侧轨道下边框宽度 */
    --left-rail-bottom-width: 3px;
    /* 左侧轨道下边框高度 */
    --left-rail-bottom-height: 71px;

    /* 垂直方向颜色线性渐变 (亮 -> 暗 -> 亮) */
    --vertical-grad: linear-gradient(
        180deg,
        rgba(81,188,255,1) 0%,
        rgba(81,188,255,0.1) 50%,
        rgba(81,188,255,1) 100%
    );
}

/* 标签容器开始 */
.solar-label {
    position: fixed;
    /* TODO: 此处是为了看到 最后要还原成0 */
    top: 30%;
    left: 30%;
    width: var(--width);
    height: var(--height);

    /* 控制显隐的属性 */
    /* TODO: 完成后取消注释 */
    //opacity: 0;
    //visibility: hidden;
    //pointer-events: none;
    transition:
        opacity 0.5s linear,
        visibility 0.5s linear;




    /* 顶部折线计算 */
    /* 顶部折线中 左折线结束点的水平位置 = 折线起点的水平位置 + 折线斜边水平距离 */
    --top-notch-left-diagonal-end-x: calc(var(--notch-start-x) + var(--notch-run-x));
    /* 顶部折线中 水平线结束点的水平位置 = 左折线结束点的水平位置 + 水平线宽度 */
    --top-notch-horizontal-end-x: calc(var(--top-notch-left-diagonal-end-x) + var(--notch-horizontal-width));
    /* 顶部折线中 右折线结束点的水平位置 = 水平线结束点的水平位置 + 折线斜边水平距离 */
    --top-notch-right-diagonal-end-x: calc(var(--top-notch-horizontal-end-x) + var(--notch-run-x));

    /* 底部折线计算 */
    /* 底部折线中 右折线起始点的水平位置 = label宽度 - 折线起点的水平位置 */
    --bottom-notch-right-diagonal-start-x: calc(var(--width) - var(--notch-start-x));
    /* 底部折线中 右折线结束点的水平位置 = 右侧折线起始点的水平位置 - 折线斜边水平距离 */
    --bottom-notch-right-diagonal-end-x: calc(var(--bottom-notch-right-diagonal-start-x) - var(--notch-run-x));
    /* 底部折线中 右折线结束点的垂直位置 = label高度 - 折线凹口深度 */
    --bottom-notch-right-diagonal-end-y: calc(var(--height) - var(--notch-depth));
    /* 底部折线中 水平线结束点的水平位置 = 右折线结束点的水平位置 - 水平线宽度 */
    --bottom-notch-horizontal-end-x: calc(var(--bottom-notch-right-diagonal-end-x) - var(--notch-horizontal-width));
    /* 底部折线中 左折线结束点的水平位置 = 水平线结束点的水平位置 - 折线斜边水平距离 */
    --bottom-notch-left-diagonal-end-x: calc(var(--bottom-notch-horizontal-end-x) - var(--notch-run-x));

    /* 左侧塌陷计算 */
    /* 左侧塌陷起始点的垂直位置 = label高度 - 左侧下边框高 */
    --left-collapse-start-y: calc(var(--height) - var(--left-rail-bottom-height));
    /* 左侧塌陷起始点的水平位置 = 左侧轨道宽 - 左侧中边框宽 */
    --left-collapse-start-x: calc(var(--left-rail-width) - var(--left-rail-middle-width));
    /* 左侧塌陷结束点的垂直位置 = 左侧塌陷起始点的垂直位置 - 左侧中边框高 */
    --left-collapse-end-y: calc(var(--left-collapse-start-y) - var(--left-rail-middle-height));
}
/* 标签容器结束 */

/* 标签裁剪区域开始 */
.label-shape {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(90deg, rgba(5, 9, 18, 0.90) 0%, rgba(5, 9, 18, 0.40) 49.98%, rgba(5, 9, 18, 0.90) 99.97%);

    /* 裁剪开始 */
    clip-path: polygon(
        /* label左上点位 */
        0px 0px,

        /* 顶部凹口开始 */
        /* 凹口起点 */
        var(--notch-start-x) 0px,
        /* 凹口左斜下点 */
        var(--top-notch-left-diagonal-end-x) var(--notch-depth),
        /* 凹口底部水平线 */
        var(--top-notch-horizontal-end-x) var(--notch-depth),
        /* 凹口终点 */
        var(--top-notch-right-diagonal-end-x) 0px,
        /* 顶部凹口结束 */

        /* label右上点位 */
        var(--width) 0px,
        /* label右下点位 */
        var(--width) var(--height),

        /* 底部凹口开始 */
        /* 凹口起点 */
        var(--bottom-notch-right-diagonal-start-x) var(--height),
        /* 凹口右斜上点 */
        var(--bottom-notch-right-diagonal-end-x) var(--bottom-notch-right-diagonal-end-y),
        /* 凹口顶部水平线 */
        var(--bottom-notch-horizontal-end-x) var(--bottom-notch-right-diagonal-end-y),
        /* 凹口终点 */
        var(--bottom-notch-left-diagonal-end-x) var(--height),
        /* 底部凹口结束 */

        /* label左下角 */
        0px var(--height),
        /* 左外边框与塌陷的连接点 */
        0px var(--left-collapse-start-y),

        /* 左侧塌陷开始 */
        /* 塌陷起始点 */
        var(--left-collapse-start-x) var(--left-collapse-start-y),
        /* 塌陷结束点 */
        var(--left-collapse-start-x) var(--left-collapse-end-y),
        /* 塌陷与左外边框的连接点 */
        0px var(--left-collapse-end-y),
        /* 左侧塌陷结束 */

        /* 裁剪终点(闭合) */
        0px 0px
    );
    /* 裁剪结束 */
}
/* 标签裁剪区域结束 */

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

/* 内部装饰层开始 */
.label-shape .inner-decor-layer {
    position: absolute;
    inset: 0;
    /* 装饰层在边框层上方 可以遮挡边框 */
    z-index: 20;
}

.label-shape .inner-decor-layer .left {
    position: absolute;
    top: 26px;
    left: 3px;
    --gradient-height: var(--height);
    --gradient-offset: 26px;
}
/* 内部装饰层结束 */

/* 外部装饰层开始 */
.solar-label .outer-decor-layer {
    position: absolute;
    inset: 0;
    /* 装饰层在边框层上方 可以遮挡边框 */
    z-index: 20;
}

/* 外部装饰层的垂直颜色渐变 */
.outer-decor-layer .seg,
.outer-decor-layer .right-rail {
    background-image: var(--vertical-grad);
    background-size: 100% var(--height);
    background-repeat: no-repeat;
}
/* 外部装饰层结束 */

/* 左侧小矩形开始 */
.outer-decor-layer .rectangle {
    top: calc(var(--left-rail-top-height) + 1px);
    /* Tips: 这里给边框设置left:0,给小矩形设置left:-3px,是为了统一坐标系,以边框左侧为x = 0处 */
    left: -3px;
    width: 4px;
    height: 7px;
    background-position: 0 calc(-1 * (var(--left-rail-top-height) + 1px));
}
/* 左侧小矩形结束 */

/* 右边框开始 */
.outer-decor-layer .right-rail {
    position: absolute;
    top: 0;
    right: -14px;
    width: 14px;
    bottom: 0;
    background-image: var(--vertical-grad);
    background-size: 100% var(--height);
    background-repeat: no-repeat;
    background-position: 0 0;
    clip-path: polygon(
        0 0,
        /* 梯形右上点位 */
        14px 15px,
        /* 梯形右下点位 */
        14px 108px,
        /* 梯形左下点位 */
        6px calc(108px + 8px * 15 / 14),
        /* 边框右下点位 */
        6px 100%,
        /* 边框左下点位 */
        0 100%
    );
}
/* 右边框结束 */

/* 斜纹条开始 */
.outer-decor-layer .stripe-chip {
    /* 斜纹条宽度 */
    --chip-width: 85px;
    /* 斜纹条高度 */
    --chip-height: 5px;
    /* 斜纹条斜纹延伸长度 (相当于斜纹的水平偏移量,和凹口斜率相同) */
    --chip-slope-run-length: calc(var(--chip-height) * var(--notch-run-x) / var(--notch-depth));

    /* 平行四边形底边长度 */
    --stripe-bottom-line-length: 7px;
    /* 平行四边形间隙 */
    --stripe-gap: 5px;

    position: absolute;
    top: 8px;
    right: 89px;
    width: var(--chip-width);
    height: var(--chip-height);

    clip-path: polygon(
        /* 左上点位 */
        var(--chip-slope-run-length) 0,
        /* 右上点位 */
        var(--chip-width) 0,
        /* 右下点位 */
        calc(var(--chip-width) - var(--chip-slope-run-length)) var(--chip-height),
        /* 左下点位 */
        0 var(--chip-height)
    );
}
/* 斜纹条结束 */

/* 平行四边形开始 */
.outer-decor-layer .stripe-chip .stripe {
    position: absolute;
    top: 0;
    height: 100%;

    /* 平行四边形宽度 = 底边长度 + 斜纹延伸长度 */
    /* Tips: 因为平行四边形的顶边比底边偏右--chip-slope-run-length个像素 */
    width: calc(var(--stripe-bottom-line-length) + var(--chip-slope-run-length));
    /* 水平方向位置 = i * (平行四边形宽度 + 平行四边形间隙) */
    left: calc(var(--i) * (var(--stripe-bottom-line-length) + var(--stripe-gap)));

    background: var(--border);

    clip-path: polygon(
        /* 左上点位 */
        var(--chip-slope-run-length) 0,
        /* 右上点位 */
        100% 0,
        /* 右下点位 */
        calc(100% - var(--chip-slope-run-length)) 100%,
        /* 左下点位 */
        0 100%
    );
}
/* 平行四边形结束 */

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