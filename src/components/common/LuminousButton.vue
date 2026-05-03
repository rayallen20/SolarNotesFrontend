<template>
    <!-- 容器层: 负责hover时的发光效果 -->
    <div class="wrap">
        <!-- 内容层: 负责渲染按钮或链接 -->
        <button v-if="usage === 'button'" class="luminous-button">See More</button>
        <RouterLink v-if="usage === 'link'" :to="{name: 'index'}" class="luminous-link">See More</RouterLink>
    </div>
</template>

<script setup>
defineOptions({
    name: 'LuminousButton',
})

defineProps({
    usage: {
        type: String,
        required: true,
        validator(value) {
            if (value === 'button') {
                return true
            }

            if (value === 'link') {
                return true
            }

            console.error('Luminous button: usage must be \'button\' or \'link\'')
            return false
        }
    }
})
</script>

<style scoped>
.wrap {
    display: inline-block;
    transition: 0.5s;
}

.wrap:hover {
    filter: drop-shadow(0 0 20px #5BDCFF);
}

.wrap .luminous-button,
.wrap .luminous-link {
    /* Tips: 此处宽度必须与SolarLabel组件中定义的--btn-width变量值相同 */
    --btn-width: 146px;

    /* display: inline-flex;的解释: 元素自身对外表现为行内元素,但该元素内部的子元素(文字)按照flex布局排列 */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--btn-width);
    height: 32px;
    outline: none;
    border: none;
    pointer-events: auto;
    background-image: linear-gradient(to right, #21AAFF, #2CFBFF);
    color: #FFFFFF;
    clip-path: polygon(
        0 16px,
        13px 0,
        132px 0,
        145px 16px,
        132px 32px,
        13px 32px,
        0 16px
    );
    font-size: 16px;
    font-family: "PingFang SC", serif;
    font-style: normal;
    font-weight: 400;
    letter-spacing: 1px;
    text-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
}

.wrap .luminous-button:hover,
.wrap .luminous-link:hover {
    cursor: pointer;
}
</style>