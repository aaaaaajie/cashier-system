<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { listMerchants } from '../api/merchant';
import { listInvoices } from '../api/invoice';
import { listBankTransfers } from '../api/bank-transfer';

const merchantTotal = ref<number>(0);
const invoicePending = ref<number>(0);
const transferPending = ref<number>(0);
const loading = ref<boolean>(false);
const errorText = ref<string>('');

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const [merchants, invoices, transfers] = await Promise.all([
      listMerchants({ page: 1, pageSize: 1 }),
      listInvoices({ status: 'pending', page: 1, pageSize: 1 }),
      listBankTransfers({ status: 'uploaded', page: 1, pageSize: 1 }),
    ]);
    merchantTotal.value = merchants.total;
    invoicePending.value = invoices.total;
    transferPending.value = transfers.total;
  } catch (err: any) {
    errorText.value = err?.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-header">
      <div>
        <h1 class="page-title">系统概览</h1>
        <p class="page-desc">聚合支付中台一期核心管理视图</p>
      </div>
      <button class="secondary" :disabled="loading" @click="load">
        {{ loading ? "刷新中..." : "刷新" }}
      </button>
    </div>

    <div class="grid cols-3">
      <div class="stat">
        <div class="stat-label">商户总数</div>
        <div class="stat-value">{{ merchantTotal }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">待处理发票</div>
        <div class="stat-value">{{ invoicePending }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">待审核打款</div>
        <div class="stat-value">{{ transferPending }}</div>
      </div>
    </div>

    <div v-if="errorText" class="card" style="margin-top: 16px">
      <div class="error-text">{{ errorText }}</div>
    </div>

    <div class="card" style="margin-top: 16px">
      <div class="hint">
        建议流程：先在「商户管理」创建商户并配置支付渠道，再用外部签名 API 创建订单并扫码支付。
      </div>
    </div>
  </section>
</template>

