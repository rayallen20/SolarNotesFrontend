<template>
    <div class="app">
        <RouterView v-slot="{Component}">
            <KeepAlive include="SolarCanvas">
                <Component :is="Component"></Component>
            </KeepAlive>
        </RouterView>
    </div>
</template>

<script setup>
import '@/assets/reset.css'
import '@/assets/font.css'
import '@/assets/index.css'
import '@/assets/iconfont/iconfont.css'

defineOptions({
    name: 'App',
})
</script>

<style scoped>
.app {
}
</style>
