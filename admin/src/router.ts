import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import DashboardView from './views/DashboardView.vue';
import LoginView from './views/LoginView.vue';
import MerchantListView from './views/MerchantListView.vue';
import InvoiceListView from './views/InvoiceListView.vue';
import BankTransferListView from './views/BankTransferListView.vue';
import { useAuthStore } from './stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: DashboardView },
  { path: '/merchants', component: MerchantListView },
  { path: '/invoices', component: InvoiceListView },
  { path: '/bank-transfers', component: BankTransferListView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  auth.init();

  if (to.meta.public) return true;
  if (auth.isAuthed) return true;

  return { path: '/login', query: { redirect: to.fullPath } };
});

export default router;

