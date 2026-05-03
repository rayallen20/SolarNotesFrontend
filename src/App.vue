<template>
<!--    <SolarCanvas></SolarCanvas>-->
    <div class="app">
        <SolarLabel></SolarLabel>
    </div>
</template>

<script setup>
import '@/assets/reset.css'
import '@/assets/font.css'
import '@/assets/index.css'
import SolarLabel from "@/components/SolarLabel.vue";
// import SolarCanvas from "@/pages/SolarCanvas.vue";

defineOptions({
    name: 'App',
})
</script>

<style scoped>
.app {
    width: 100vw;
    height: 100vh;
    background: darkblue;
}
</style>
