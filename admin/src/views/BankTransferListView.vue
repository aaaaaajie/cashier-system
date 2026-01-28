<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { listBankTransfers, reviewBankTransfer, type BankTransferItem } from '../api/bank-transfer';

const loading = ref(false);
const errorText = ref('');
const total = ref(0);
const items = ref<BankTransferItem[]>([]);

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
    const res = await listBankTransfers({
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

async function onReview(item: BankTransferItem, action: 'confirm' | 'reject') {
  loading.value = true;
  errorText.value = '';
  try {
    await reviewBankTransfer(item.transferId, {
      action,
      reviewerId: 'admin-ui',
      reviewNote: action === 'confirm' ? '审核通过' : '审核拒绝',
    });
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
        <h1 class="page-title">对公打款审核</h1>
        <p class="page-desc">审核上传的打款凭证并确认订单完成</p>
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
          <option value="uploaded">uploaded</option>
          <option value="confirmed">confirmed</option>
          <option value="rejected">rejected</option>
        </select>
        <button class="secondary" :disabled="loading" @click="load">查询</button>
      </div>

      <div class="hint" style="margin-bottom: 10px">共 {{ total }} 条记录</div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>transferId</th>
              <th>merchantId</th>
              <th>orderId</th>
              <th>金额(分)</th>
              <th>状态</th>
              <th>凭证</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.transferId">
              <td>{{ item.transferId }}</td>
              <td>{{ item.merchantId }}</td>
              <td>{{ item.orderId }}</td>
              <td>{{ item.amount }}</td>
              <td><span class="badge" :class="item.status">{{ item.status }}</span></td>
              <td>
                <a v-if="item.proofUrl" :href="item.proofUrl" target="_blank" class="hint">查看</a>
                <span v-else class="hint">-</span>
              </td>
              <td style="display: flex; gap: 6px">
                <button
                  class="secondary"
                  :disabled="loading || item.status !== 'uploaded'"
                  @click="onReview(item, 'confirm')"
                >
                  通过
                </button>
                <button
                  class="danger"
                  :disabled="loading || item.status !== 'uploaded'"
                  @click="onReview(item, 'reject')"
                >
                  驳回
                </button>
              </td>
            </tr>
            <tr v-if="!loading && items.length === 0">
              <td colspan="7" class="hint">暂无数据</td>
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

