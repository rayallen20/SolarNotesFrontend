<template>
    <div class="outer-decor-layer">
        <!-- 左侧小矩形开始 -->
        <div class="seg rectangle"></div>
        <!-- 左侧小矩形结束 -->

        <!-- 右边框开始 -->
        <div class="right-rail"></div>
        <!-- 右边框结束 -->

        <!-- 斜纹条开始 -->
        <div class="stripe-chip">
            <!-- 传送带(用于整体平移的图层)开始 -->
            <div class="stripe-track">
                <!-- 平行四边形开始 -->
                <div
                    class="stripe"
                    v-for="n in 9"
                    :key="n"
                    :style="`--i: ${n - 2}`">
                </div>
                <!-- 平行四边形结束 -->
            </div>
            <!-- 传送带结束 -->
        </div>
        <!-- 斜纹条结束 -->
    </div>
</template>

<script setup>
defineOptions({
    name: 'OuterDecorLayer',
})
</script>

<style scoped>
/* 外部装饰层开始 */
.outer-decor-layer {
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
    --chip-width: 136px;
    /* 斜纹条高度 */
    --chip-height: 5px;
    /* 斜纹条斜纹延伸长度 (相当于斜纹的水平偏移量,和凹口斜率相同) */
    --chip-slope-run-length: calc(var(--chip-height) * var(--notch-run-x) / var(--notch-depth));

    /* 平行四边形底边长度 */
    --stripe-bottom-line-length: 12px;
    /* 平行四边形间隙 */
    --stripe-gap: 5px;

    /* 平移周期: 平行四边形水平间距 = 底边长度 + 间隙 */
    --stripe-pitch: calc(var(--stripe-bottom-line-length) + var(--stripe-gap));
    /* 走马灯单词循环时长 该值越小速度越快 */
    --marquee-duration: 1s;

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

/*传送带开始*/
.outer-decor-layer .stripe-chip .stripe-track {
    position: absolute;
    inset: 0;
    animation: stripe-marquee var(--marquee-duration) linear infinite;
}

@keyframes stripe-marquee {
    from {
        transform: translateX(0);
    }
    to {
        /* 平移1个pitch */
        transform: translateX(var(--stripe-pitch));
    }
}

/* 兼容减少动态效果: 停止走马灯动画 退化为静态斜纹条 */
@media (prefers-reduced-motion: reduce) {
    .outer-decor-layer .stripe-chip .stripe-track {
        animation: none;
    }
}
/*传送带结束*/

/* 斜纹条结束 */

/* 平行四边形开始 */
.outer-decor-layer .stripe-chip .stripe {
    position: absolute;
    top: 0;
    height: 100%;

    /* 平行四边形宽度 = 底边长度 + 斜纹延伸长度 */
    /* Tips: 因为平行四边形的顶边比底边偏右--chip-slope-run-length个像素 */
    width: calc(var(--stripe-bottom-line-length) + var(--chip-slope-run-length));
    /* 水平方向位置 = i * (平移周期) */
    left: calc(var(--i) * var(--stripe-pitch));

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
</style>