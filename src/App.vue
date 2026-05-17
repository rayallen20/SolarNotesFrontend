<template>
    <div class="app">
        <SolarCanvas></SolarCanvas>
    </div>
</template>

<script setup>
import '@/assets/reset.css'
import '@/assets/font.css'
import '@/assets/index.css'
import SolarCanvas from "@/pages/SolarCanvas.vue";

defineOptions({
    name: 'App',
})
</script>

<style scoped>
.app {
}
</style>
