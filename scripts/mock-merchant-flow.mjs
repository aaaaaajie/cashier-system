import crypto from 'crypto';
import http from 'http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CALLBACK_PORT = Number(process.env.CALLBACK_PORT || 9999);
const CALLBACK_PATH = '/payment-callback';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function signParams(params, timestamp, nonce, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  const parts = sortedKeys
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => `${key}=${normalizeValue(params[key])}`);
  parts.push(`timestamp=${timestamp}`);
  parts.push(`nonce=${nonce}`);
  const payload = parts.join('&');
  return crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
}

function signedHeaders(appKey, appSecret, params = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(12).toString('hex');
  const signature = signParams(params, timestamp, nonce, appSecret);
  return {
    'Content-Type': 'application/json',
    'X-App-Key': appKey,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature': signature,
  };
}

async function requestJson(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function unwrapEnvelope(envelope) {
  if (!envelope || typeof envelope.code !== 'number') return envelope;
  if (envelope.code !== 0) {
    throw new Error(`API ${envelope.code}: ${envelope.message}`);
  }
  return envelope.data;
}

function startMockCallbackServer() {
  const events = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = raw;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = raw;
    }
    events.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
      timestamp: new Date().toISOString(),
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      resolve({
        server,
        events,
        callbackUrl: `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`,
      });
    });
  });
}

async function main() {
  console.log('[1/7] Starting mock callback server...');
  const callback = await startMockCallbackServer();
  console.log(`      Callback URL: ${callback.callbackUrl}`);

  console.log('[2/7] Admin login...');
  const loginEnvelope = await requestJson('/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const login = unwrapEnvelope(loginEnvelope);
  const adminToken = login.accessToken;
  console.log('      Admin token acquired.');

  console.log('[3/7] Create merchant...');
  const merchantEnvelope = await requestJson('/api/v1/admin/merchants', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: `Mock Merchant ${new Date().toISOString()}`,
      callbackUrl: callback.callbackUrl,
      ipWhitelist: [],
    }),
  });
  const merchant = unwrapEnvelope(merchantEnvelope);
  console.log(`      merchantId: ${merchant.merchantId}`);
  console.log(`      appKey:     ${merchant.appKey}`);

  console.log('[4/7] Configure payment channels (mock config)...');
  const configEnvelope = await requestJson(
    `/api/v1/admin/merchants/${merchant.merchantId}/payment-config`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        wechat: {
          mchId: 'wx_mch_mock_001',
          appId: 'wx_app_mock_001',
          apiKeyV3: 'mock_wechat_api_key_v3',
          certSerialNo: 'mock_cert_serial_no',
          privateKey: 'mock_private_key',
        },
        alipay: {
          appId: 'ali_app_mock_001',
          privateKey: 'mock_alipay_private_key',
          alipayPublicKey: 'mock_alipay_public_key',
          signType: 'RSA2',
        },
      }),
    },
  );
  unwrapEnvelope(configEnvelope);
  console.log('      Payment channels configured.');

  const externalOrderId = `ext_${Date.now()}`;
  const orderPayload = {
    externalOrderId,
    subject: 'Mock 商品：统一收银演示',
    description: '用于本地联调的模拟订单',
    amount: 9900,
    currency: 'CNY',
    expireMinutes: 30,
    notifyUrl: callback.callbackUrl,
    returnUrl: 'http://localhost:8080/result',
    metadata: {
      scenario: 'mock-merchant-flow',
      externalOrderId,
    },
  };

  console.log('[5/7] Create signed order...');
  const orderHeaders = signedHeaders(merchant.appKey, merchant.appSecret, orderPayload);
  const orderEnvelope = await requestJson('/api/v1/orders', {
    method: 'POST',
    headers: orderHeaders,
    body: JSON.stringify(orderPayload),
  });
  const order = unwrapEnvelope(orderEnvelope);
  console.log(`      orderId:    ${order.orderId}`);
  console.log(`      qrcodeUrl:  ${order.qrcodeUrl}`);
  console.log(`      cashierToken: ${order.cashierToken}`);

  const token = order.cashierToken;

  console.log('[6/7] Create payment from cashier API...');
  const cashierOrderEnvelope = await requestJson(
    `/api/v1/cashier/orders/${order.orderId}?t=${encodeURIComponent(token)}`,
  );
  const cashierOrder = unwrapEnvelope(cashierOrderEnvelope);
  console.log(`      cashier status(before): ${cashierOrder.status}`);

  const payEnvelope = await requestJson('/api/v1/cashier/pay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderId: order.orderId,
      token,
      channel: 'alipay',
    }),
  });
  const payResult = unwrapEnvelope(payEnvelope);
  console.log(`      paymentId: ${payResult.paymentId}`);

  console.log('[6.5/7] Query signed order to get channelOrderId...');
  const orderDetailHeaders = signedHeaders(merchant.appKey, merchant.appSecret, {});
  const orderDetailEnvelope = await requestJson(`/api/v1/orders/${order.orderId}`, {
    method: 'GET',
    headers: orderDetailHeaders,
  });
  const orderDetail = unwrapEnvelope(orderDetailEnvelope);
  console.log(`      channelOrderId: ${orderDetail.channelOrderId}`);

  console.log('[7/7] Simulate channel callback and wait for paid...');
  await requestJson('/api/v1/callbacks/alipay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderId: order.orderId,
      channelOrderId: orderDetail.channelOrderId,
      amount: orderPayload.amount,
      success: true,
    }),
  });

  let finalOrder = orderDetail;
  for (let i = 0; i < 10; i += 1) {
    await sleep(800);
    const headers = signedHeaders(merchant.appKey, merchant.appSecret, {});
    const envelope = await requestJson(`/api/v1/orders/${order.orderId}`, {
      method: 'GET',
      headers,
    });
    finalOrder = unwrapEnvelope(envelope);
    if (finalOrder.status === 'paid') break;
  }

  // Wait for notification scheduler (runs every 10s) to deliver callbacks
  for (let i = 0; i < 15; i += 1) {
    if (callback.events.length > 0) break;
    await sleep(1000);
  }
  callback.server.close();

  const summary = {
    baseUrl: BASE_URL,
    admin: { username: 'admin' },
    merchant: {
      merchantId: merchant.merchantId,
      appKey: merchant.appKey,
      appSecret: merchant.appSecret,
      callbackUrl: callback.callbackUrl,
    },
    order: {
      orderId: order.orderId,
      externalOrderId,
      amount: orderPayload.amount,
      qrcodeUrl: order.qrcodeUrl,
      cashierToken: token,
      status: finalOrder.status,
      channelOrderId: finalOrder.channelOrderId,
      paidAt: finalOrder.paidAt,
    },
    payment: {
      paymentId: payResult.paymentId,
      payUrl: payResult.payUrl || null,
      qrcodeUrl: payResult.qrcodeUrl || null,
    },
    callbackEvents: callback.events,
  };

  console.log('\n=== MOCK FLOW SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('\nMock flow failed:', err);
  process.exitCode = 1;
});
