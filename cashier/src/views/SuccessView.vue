<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const returnUrl = computed(() => String(route.query.returnUrl || ''));
const orderId = computed(() => String(route.query.orderId || ''));

function goBack() {
  if (returnUrl.value) {
    window.location.href = returnUrl.value;
    return;
  }
  router.replace('/');
}
</script>

<template>
  <div class="page">
    <div class="card">
      <div class="icon">✅</div>
      <h1>支付成功</h1>
      <p v-if="orderId">订单号：{{ orderId }}</p>
      <button class="btn" @click="goBack">返回业务系统</button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f5f6f8;
}
.card {
  background: #fff;
  padding: 32px 40px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
}
.icon {
  font-size: 36px;
  margin-bottom: 8px;
}
.btn {
  margin-top: 16px;
  padding: 10px 20px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
</style>
