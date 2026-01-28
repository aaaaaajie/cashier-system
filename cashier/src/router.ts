import { createRouter, createWebHistory } from 'vue-router';
import PayView from './views/PayView.vue';
import ExternalPayView from './views/ExternalPayView.vue';
import SuccessView from './views/SuccessView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/pay/demo' },
    { path: '/pay/:orderId', component: PayView },
    { path: '/external', component: ExternalPayView },
    { path: '/success', component: SuccessView },
  ],
});

export default router;
