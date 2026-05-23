import { createRouter, createWebHistory } from 'vue-router'
import App from "@/App.vue";

const routes = [
    {
        path: '/',
        redirect: {
            name: 'solar',
        }
    },
    {
        path: '/solar',
        component: import('@/pages/SolarCanvas.vue'),
        name: 'solar',
    },
    {
        path: '/article',
        component: () => import('@/pages/ArticleReader.vue'),
        name: 'article',
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

export default router
