<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createCashierPayment, getCashierOrder, type CashierOrder } from '../api/cashier';
import { detectPayEnv } from '../utils/env';

const route = useRoute();
const router = useRouter();

const orderId = computed(() => String(route.params.orderId || ''));
const token = computed(() => String(route.query.t || ''));

const env = detectPayEnv();

const loading = ref(false);
const paying = ref(false);
const errorText = ref('');
const order = ref<CashierOrder | null>(null);
const payResult = ref<any>(null);

const form = reactive({
  channel: env === 'wechat' ? 'wechat' : env === 'alipay' ? 'alipay' : 'alipay',
  openId: '',
});

const isPaid = computed(() => order.value?.status === 'paid');
const isExpired = computed(() => ['expired', 'closed'].includes(order.value?.status || ''));

async function loadOrder() {
  if (!orderId.value) {
    errorText.value = '缺少订单号';
    return;
  }
  if (!token.value) {
    errorText.value = '缺少 token，请从正确的二维码链接进入';
    return;
  }
  loading.value = true;
  errorText.value = '';
  try {
    order.value = await getCashierOrder(orderId.value, token.value);
  } catch (err: any) {
    errorText.value = err?.message || '加载订单失败';
  } finally {
    loading.value = false;
  }
}

async function onPay() {
  if (!order.value || isPaid.value || isExpired.value) return;
  if (form.channel === 'wechat' && !form.openId.trim()) {
    errorText.value = '微信支付需要 openId（演示环境可手动填写）';
    return;
  }
  paying.value = true;
  errorText.value = '';
  try {
    payResult.value = await createCashierPayment({
      orderId: order.value.orderId,
      token: token.value,
      channel: form.channel as 'wechat' | 'alipay',
      openId: form.channel === 'wechat' ? form.openId.trim() : undefined,
    });
    await loadOrder();
  } catch (err: any) {
    errorText.value = err?.message || '支付请求失败';
  } finally {
    paying.value = false;
  }
}

function formatAmount(amount: number) {
  return (amount / 100).toFixed(2);
}

function statusClass(status?: string) {
  return status || 'pending';
}

function goHome() {
  router.replace('/');
}

watch(
  () => route.fullPath,
  () => {
    payResult.value = null;
    loadOrder();
  },
);

onMounted(loadOrder);
</script>

<template>
  <div class="page">
    <div class="card">
      <div class="header">
        <div>
          <h1 class="title">统一收银台</h1>
          <p class="subtitle">自动识别微信 / 支付宝环境并调用后端收银接口</p>
        </div>
        <div class="row">
          <button class="secondary" :disabled="loading" @click="loadOrder">
            {{ loading ? "刷新中..." : "刷新" }}
          </button>
        </div>
      </div>

      <div v-if="order" style="margin-bottom: 8px">
        <div class="label">商品 / 订单</div>
        <div style="font-weight: 800; font-size: 18px">{{ order.subject }}</div>
        <div class="amount">¥ {{ formatAmount(order.amount) }}</div>
        <div class="hint">单位：元（订单原始金额为分）</div>

        <div class="meta">
          <div class="meta-item">
            <div class="meta-label">订单号</div>
            <div class="meta-value">{{ order.orderId }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">状态</div>
            <div class="meta-value">
              <span class="badge" :class="statusClass(order.status)">{{ order.status }}</span>
            </div>
          </div>
          <div class="meta-item">
            <div class="meta-label">过期时间</div>
            <div class="meta-value">{{ order.expireAt }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">支付渠道 / 方式</div>
            <div class="meta-value">
              {{ order.paymentChannel || "-" }} / {{ order.paymentMethod || "-" }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="!order && loading" class="section">
        <div class="hint">正在加载订单...</div>
      </div>

      <div v-if="order" class="section">
        <div class="label">支付环境</div>
        <div class="row">
          <span class="badge" :class="env">{{ env }}</span>
          <span class="hint">可手动选择渠道以便调试</span>
        </div>

        <div class="divider"></div>

        <div class="row" style="margin-bottom: 10px">
          <div style="flex: 1 1 220px">
            <div class="label">支付渠道</div>
            <select v-model="form.channel" :disabled="isPaid || isExpired">
              <option value="alipay">支付宝</option>
              <option value="wechat">微信</option>
            </select>
          </div>

          <div v-if="form.channel === 'wechat'" style="flex: 1 1 220px">
            <div class="label">openId（微信必填）</div>
            <input v-model="form.openId" :disabled="isPaid || isExpired" placeholder="openid_xxx" />
          </div>
        </div>

        <div class="pay-actions">
          <button :disabled="paying || isPaid || isExpired" @click="onPay">
            {{ paying ? "请求中..." : isPaid ? "已支付" : isExpired ? "订单不可支付" : "立即支付" }}
          </button>
          <button class="secondary" @click="loadOrder">查询状态</button>
          <button class="secondary" @click="goHome">回到首页</button>
        </div>

        <div v-if="isPaid" class="hint" style="margin-top: 8px; color: var(--success)">
          ✅ 订单已支付成功
        </div>
        <div v-else-if="isExpired" class="hint" style="margin-top: 8px; color: var(--danger)">
          ⚠️ 订单已过期或关闭
        </div>
      </div>

      <div v-if="payResult" class="section">
        <div class="label">支付请求结果</div>
        <div v-if="payResult.payUrl" style="margin-bottom: 8px">
          <div class="hint" style="margin-bottom: 6px">渠道返回 payUrl，可直接跳转：</div>
          <a :href="payResult.payUrl" target="_blank">
            <button>前往渠道支付</button>
          </a>
        </div>
        <pre>{{ JSON.stringify(payResult, null, 2) }}</pre>
      </div>

      <div v-if="errorText" class="section">
        <div class="error">{{ errorText }}</div>
      </div>

      <div class="section">
        <div class="hint">
          提示：正确的二维码链接应包含 `?t=...` token（由后端创建订单时返回）。
        </div>
      </div>
    </div>
  </div>
</template>

