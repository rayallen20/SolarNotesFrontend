import { createRouter, createWebHistory } from 'vue-router'
import SolarCanvas from "@/pages/SolarCanvas.vue";

const routes = [
    {
        path: '/',
        redirect: {
            name: 'solar',
        }
    },
    {
        path: '/solar',
        component: SolarCanvas,
        name: 'solar',
    },
    {
        path: '/article/:id',
        component: () => import('@/pages/ArticleReader.vue'),
        name: 'article',
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

export default router
