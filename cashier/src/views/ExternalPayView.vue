<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createCashierPayment, getCashierOrder, mockChannelPaid, prepareExternalPayment, type CashierOrder } from '../api/cashier';
import { detectPayEnv } from '../utils/env';

const route = useRoute();
const router = useRouter();

const merchantId = computed(() => String(route.query.merchantId || ''));
const externalOrderId = computed(() => String(route.query.externalOrderId || ''));

const env = detectPayEnv();

const loading = ref(false);
const paying = ref(false);
const simulating = ref(false);
const errorText = ref('');
const order = ref<CashierOrder | null>(null);
const token = ref('');
const payResult = ref<any>(null);
const payQrData = ref('');

const channel = computed(() => (env === 'wechat' ? 'wechat' : env === 'alipay' ? 'alipay' : 'alipay'));

const isPaid = computed(() => order.value?.status === 'paid');
const isExpired = computed(() => ['expired', 'closed'].includes(order.value?.status || ''));

async function loadOrder() {
  if (!merchantId.value || !externalOrderId.value) {
    errorText.value = '缺少 merchantId 或 externalOrderId';
    return;
  }

  loading.value = true;
  errorText.value = '';
  try {
    const prepared: any = await prepareExternalPayment({
      merchantId: merchantId.value,
      externalOrderId: externalOrderId.value,
    });
    token.value = prepared.cashierToken;
    order.value = {
      orderId: prepared.orderId,
      externalOrderId: prepared.externalOrderId,
      subject: prepared.subject,
      amount: prepared.amount,
      currency: prepared.currency,
      status: prepared.status,
      expireAt: prepared.expireAt,
      paidAt: null,
      paymentChannel: null,
      paymentMethod: null,
      returnUrl: prepared.returnUrl || null,
      metadata: prepared.metadata || null,
    } as CashierOrder;

    if (prepared.orderId && token.value) {
      order.value = await getCashierOrder(prepared.orderId, token.value);
    }
  } catch (err: any) {
    errorText.value = err?.message || '加载订单失败';
  } finally {
    loading.value = false;
  }
}

async function onPay() {
  if (!order.value || isPaid.value || isExpired.value) return;
  paying.value = true;
  errorText.value = '';
  try {
    payResult.value = await createCashierPayment({
      orderId: order.value.orderId,
      token: token.value,
      channel: channel.value as 'wechat' | 'alipay',
    });
    if (payResult.value?.qrcodeUrl) await generatePayQr(payResult.value.qrcodeUrl);
    await loadOrder();
  } catch (err: any) {
    errorText.value = err?.message || '支付请求失败';
  } finally {
    paying.value = false;
  }
}

async function generatePayQr(url: string) {
  if (!url) return;
  const QRCode = await import('qrcode');
  payQrData.value = await QRCode.toDataURL(url, { width: 220, margin: 1 });
}

async function onMockPaid() {
  if (!order.value) return;
  if (!order.value.channelOrderId) {
    errorText.value = '尚未生成支付二维码，请先点击支付';
    return;
  }
  simulating.value = true;
  errorText.value = '';
  try {
    await mockChannelPaid({
      orderId: order.value.orderId,
      channelOrderId: order.value.channelOrderId,
      amount: order.value.amount,
    });
    await loadOrder();
    router.replace({
      path: '/success',
      query: { returnUrl: order.value?.returnUrl || '', orderId: order.value.orderId },
    });
  } catch (err: any) {
    errorText.value = err?.message || '模拟支付失败';
  } finally {
    simulating.value = false;
  }
}

onMounted(async () => {
  await loadOrder();
  await onPay();
});
</script>

<template>
  <div class="page">
    <div class="topbar">
      <div class="brand">收银台</div>
      <div class="right">简体中文 ▾</div>
    </div>

    <div class="container">
      <div v-if="payResult" class="section">
        <div class="section-title">扫码支付</div>
        <div class="qr-box">
          <img v-if="payQrData" :src="payQrData" alt="支付二维码" style="width:220px;height:220px;" />
          <div v-else class="qr-url">{{ payResult.qrcodeUrl }}</div>
          <button class="secondary" style="margin-top:8px;" :disabled="simulating" @click="onMockPaid">
            {{ simulating ? "处理中..." : "已扫码支付" }}
          </button>
        </div>
      </div>

      <div v-if="errorText" class="section">
        <div class="error">{{ errorText }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6f8;
  color: #111;
}
.topbar {
  height: 56px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid #eee;
}
.brand {
  font-weight: 700;
}
.right {
  color: #666;
  font-size: 13px;
}
.container {
  max-width: 1100px;
  margin: 24px auto 80px;
  padding: 0 12px;
}
.section {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.section-title {
  font-weight: 700;
  margin-bottom: 12px;
}
.qr-box {
  border: 1px dashed #d1d5db;
  padding: 12px;
  border-radius: 8px;
}
.qr-title {
  font-weight: 700;
  margin-bottom: 6px;
}
.qr-url {
  font-size: 12px;
  color: #555;
}
.secondary {
  background: #fff;
  border: 1px solid #cbd5f5;
  color: #2563eb;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
}
.error {
  color: #dc2626;
}
</style>
