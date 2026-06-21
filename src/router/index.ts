import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
    },
    {
      path: '/visualizer',
      name: 'visualizer',
      component: () => import('../views/Visualizer.vue'),
    },
  ],
})

export default router
