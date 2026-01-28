<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { issueInvoice, listInvoices, type InvoiceItem } from '../api/invoice';

const loading = ref(false);
const errorText = ref('');
const total = ref(0);
const items = ref<InvoiceItem[]>([]);

const query = reactive({
  merchantId: '',
  orderId: '',
  status: '',
  page: 1,
  pageSize: 20,
});

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const res = await listInvoices({
      merchantId: query.merchantId || undefined,
      orderId: query.orderId || undefined,
      status: query.status || undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    total.value = res.total;
    items.value = res.data;
  } catch (err: any) {
    errorText.value = err?.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

async function onIssue(item: InvoiceItem) {
  if (item.status !== 'pending') return;
  loading.value = true;
  errorText.value = '';
  try {
    await issueInvoice(item.invoiceId, { operatorId: 'admin-ui' });
    await load();
  } catch (err: any) {
    errorText.value = err?.message || '操作失败';
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
        <h1 class="page-title">发票管理</h1>
        <p class="page-desc">查看发票申请并进行人工确认开票</p>
      </div>
      <button class="secondary" :disabled="loading" @click="load">
        {{ loading ? "刷新中..." : "刷新" }}
      </button>
    </div>

    <div class="card">
      <div class="toolbar">
        <input v-model="query.merchantId" placeholder="merchantId" />
        <input v-model="query.orderId" placeholder="orderId" />
        <select v-model="query.status">
          <option value="">全部状态</option>
          <option value="pending">pending</option>
          <option value="issued">issued</option>
          <option value="cancelled">cancelled</option>
        </select>
        <button class="secondary" :disabled="loading" @click="load">查询</button>
      </div>

      <div class="hint" style="margin-bottom: 10px">共 {{ total }} 条记录</div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>invoiceId</th>
              <th>merchantId</th>
              <th>orderId</th>
              <th>类型</th>
              <th>抬头</th>
              <th>金额(分)</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.invoiceId">
              <td>{{ item.invoiceId }}</td>
              <td>{{ item.merchantId }}</td>
              <td>{{ item.orderId }}</td>
              <td>{{ item.type }}</td>
              <td>{{ item.title }}</td>
              <td>{{ item.amount }}</td>
              <td><span class="badge" :class="item.status">{{ item.status }}</span></td>
              <td>
                <button class="secondary" :disabled="loading || item.status !== 'pending'" @click="onIssue(item)">
                  确认开票
                </button>
              </td>
            </tr>
            <tr v-if="!loading && items.length === 0">
              <td colspan="8" class="hint">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="errorText" class="card">
      <div class="error-text">{{ errorText }}</div>
    </div>
  </section>
</template>

