<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
auth.init();

const showShell = computed(() => route.path !== '/login');

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div v-if="showShell" class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-title">统一收银系统</div>
        <div class="brand-subtitle">Cashier Admin</div>
      </div>

      <nav class="nav">
        <router-link to="/dashboard">概览</router-link>
        <router-link to="/merchants">商户管理</router-link>
        <router-link to="/invoices">发票管理</router-link>
        <router-link to="/bank-transfers">对公打款</router-link>
      </nav>

      <div class="sidebar-footer">
        <div>当前账号：{{ auth.username }}</div>
        <div style="margin-top: 8px">
          <button class="secondary" @click="logout">退出登录</button>
        </div>
      </div>
    </aside>

    <main class="content">
      <router-view />
    </main>
  </div>

  <div v-else>
    <router-view />
  </div>
</template>

