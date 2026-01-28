import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';

import { CashierSdk } from './sdk/cashier-sdk.mjs';

const PORT = Number(process.env.EXTERNAL_BIZ_PORT || 7001);
const CASHIER_SERVER_BASE_URL =
  process.env.CASHIER_SERVER_BASE_URL || process.env.CASHIER_SERVER_BASE || 'http://localhost:3000';
const CASHIER_CLIENT_BASE_URL = process.env.CASHIER_CLIENT_BASE_URL || 'http://localhost:8080';

const sdk = new CashierSdk({
  baseUrl: CASHIER_SERVER_BASE_URL,
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
});

const state = {
  merchant: null,
  products: [
    {
      productId: 'cloud-ecs-month',
      title: '云服务器 ECS(月付)',
      description: '2核 2G c7 · 系列VI · 优化实例',
      unitPrice: 45704,
      currency: 'CNY',
      duration: '1 年',
    },
  ],
  orders: [],
  callbacks: [],
  paymentRecords: [],
  logs: [],
  sharedSecret: process.env.EXTERNAL_SHARED_SECRET || 'demo_shared_secret_2026',
  merchantConfig: {
    wechat: {
      mchId: '',
      appId: '',
      apiKeyV3: '',
      certSerialNo: '',
      privateKey: '',
    },
    alipay: {
      appId: '',
      privateKey: '',
      alipayPublicKey: '',
      signType: 'RSA2',
    },
  },
  activeTab: 'order',
  platformTab: 'alipay',
  preset: 'custom',
  paysetSnapshot: null,
  paysetError: null,
  paysetPage: 1,
  paysetPageSize: 20,
  highlightOrderId: '',
};

const PRESETS = {
  mock_wechat: {
    wechat: {
      mchId: 'wx_mch_mock_001',
      appId: 'wx_app_mock_001',
      apiKeyV3: 'mock_wechat_api_key_v3',
      certSerialNo: 'mock_cert_serial_no',
      privateKey: 'mock_private_key',
    },
    alipay: null,
  },
  mock_alipay: {
    wechat: null,
    alipay: {
      appId: 'ali_app_mock_001',
      privateKey: 'mock_alipay_private_key',
      alipayPublicKey: 'mock_alipay_public_key',
      signType: 'RSA2',
    },
  },
  mock_both: {
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
  },
};

function logLine(message, extra) {
  const entry = { ts: new Date().toISOString(), message, extra: extra ?? null };
  state.logs.unshift(entry);
  state.logs = state.logs.slice(0, 120);
  if (extra) {
    console.log(`[external-biz] ${message}`, extra);
  } else {
    console.log(`[external-biz] ${message}`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function signOrderSnapshot(payload, sharedSecret) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(12).toString('hex');
  const params = { ...payload };
  const sortedKeys = Object.keys(params).sort();
  const parts = sortedKeys
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => `${key}=${typeof params[key] === 'object' ? JSON.stringify(params[key]) : String(params[key])}`);
  parts.push(`timestamp=${timestamp}`);
  parts.push(`nonce=${nonce}`);
  const payloadStr = parts.join('&');
  const signature = crypto.createHmac('sha256', sharedSecret).update(payloadStr).digest('hex');
  return { timestamp, nonce, signature };
}

function callbackUrl() {
  return `http://127.0.0.1:${PORT}/callbacks/payment`;
}

function resultUrl(orderId) {
  return `http://127.0.0.1:${PORT}/result?orderId=${encodeURIComponent(orderId)}`;
}

function paysetUrl(orderId) {
  return `http://127.0.0.1:${PORT}/tabs/payset?orderId=${encodeURIComponent(orderId)}`;
}

function findOrder(orderId) {
  return state.orders.find((o) => o.orderId === orderId);
}

function newOrderId() {
  return `BIZ${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

async function bootstrapMerchant() {
  if (state.merchant) return state.merchant;
  const merchant = await sdk.createMerchant({
    name: `External Biz Demo ${new Date().toISOString()}`,
    callbackUrl: callbackUrl(),
  });
  await sdk.configureExternal(merchant.merchantId, {
    baseUrl: `http://127.0.0.1:${PORT}`,
    sharedSecret: state.sharedSecret,
    orderDetailPath: '/api/orders/:orderId',
  });

  for (const product of state.products) {
    await sdk.upsertProduct(product);
  }

  state.merchant = merchant;
  logLine('Merchant bootstrapped and external config synced.', merchant);
  return merchant;
}

function createBusinessOrder(productId) {
  const product = state.products.find((p) => p.productId === productId) || state.products[0];
  const orderId = newOrderId();
  const order = {
    orderId,
    productId: product.productId,
    subject: product.title,
    description: product.description,
    amount: product.unitPrice,
    currency: product.currency,
    status: 'created',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: product.duration,
  };
  state.orders.unshift(order);
  state.orders = state.orders.slice(0, 50);
  return order;
}

async function syncPayset() {
  try {
    if (!state.merchant) await bootstrapMerchant();
    const snapshot = await sdk.queryPayset({
      page: state.paysetPage,
      pageSize: state.paysetPageSize,
      sortField: 'paidAt',
      sortOrder: 'desc',
    });
    state.paysetSnapshot = {
      ts: new Date().toISOString(),
      data: snapshot,
    };
    state.paysetError = null;
  } catch (err) {
    state.paysetError = err?.message || String(err);
    logLine('Failed to sync payset.', { error: state.paysetError });
  }
  return state.paysetSnapshot;
}

function renderPaysetRows() {
  const rows = state.paysetSnapshot?.data?.dataset || [];
  if (!rows.length) {
    return '<tr><td colspan="7" style="text-align:center;color:#999;padding:24px;">暂无支付记录</td></tr>';
  }
  const statusMap = { paid: '已支付', pending: '待支付', expired: '已过期', closed: '已关闭' };
  const statusColorMap = { paid: '#16a34a', pending: '#f59e0b', expired: '#9ca3af', closed: '#ef4444' };
  const channelMap = { wechat: '微信支付', alipay: '支付宝' };
  return rows
    .map((r) => {
      const highlight = state.highlightOrderId && r.externalOrderId === state.highlightOrderId;
      const className = highlight ? ' class="highlight"' : '';
      const statusLabel = statusMap[r.status] || r.status || '-';
      const statusColor = statusColorMap[r.status] || '#666';
      const channelLabel = channelMap[r.paymentChannel] || r.paymentChannel || '-';
      const paidAtFormatted = r.paidAt
        ? new Date(r.paidAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        : '-';
      return (
        `<tr${className}>` +
        `<td>${escapeHtml(r.orderId)}</td>` +
        `<td>${escapeHtml(r.externalOrderId || '-')}</td>` +
        `<td>${escapeHtml(r.subject || '-')}</td>` +
        `<td style="text-align:right;">¥ ${(Number(r.amount || 0) / 100).toFixed(2)}</td>` +
        `<td>${escapeHtml(channelLabel)}</td>` +
        `<td><span style="color:${statusColor};font-weight:600;">${escapeHtml(statusLabel)}</span></td>` +
        `<td>${escapeHtml(paidAtFormatted)}</td>` +
        `</tr>`
      );
    })
    .join('');
}

function renderPage() {
  const merchant = state.merchant;
  const latest = state.orders[0];
  const product = state.products[0];
  const wx = state.merchantConfig.wechat;
  const ali = state.merchantConfig.alipay;

  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>支付 - 外部业务系统</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: #f5f6f8; }
        .topbar { height: 56px; background: #fff; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
        .logo { font-weight: 700; color: #ff6a00; }
        .container { max-width: 1100px; margin: 24px auto 80px; padding: 0 12px; }
        .section { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; }
        .section-title { font-weight: 700; margin-bottom: 12px; }
        .amount { display: flex; justify-content: flex-end; color: #666; margin-bottom: 8px; }
        .amount span { color: #f97316; font-weight: 700; margin-left: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border-bottom: 1px solid #eee; padding: 8px 6px; text-align: left; }
        th { background: #fafafa; }
        .tabs { display: flex; gap: 14px; border-bottom: 1px solid #eee; margin-bottom: 12px; }
        .tab { padding: 8px 0; color: #666; }
        .tab.active { color: #2563eb; border-bottom: 2px solid #2563eb; }
        .tab-bar { display:flex; gap:14px; border-bottom:1px solid #eee; margin-bottom:16px; }
        .tab-item { padding:8px 0; color:#666; text-decoration:none; }
        .tab-item.active { color:#2563eb; border-bottom:2px solid #2563eb; }
        .sub-tabs { display:flex; gap:12px; margin:12px 0; }
        .sub-tab { padding:6px 10px; border:1px solid #e5e7eb; border-radius:8px; color:#666; text-decoration:none; font-size:12px; }
        .sub-tab.active { border-color:#2563eb; color:#2563eb; background:#f5f8ff; }
        .highlight { background:#fff7ed; }
        .pay-cards { display: flex; gap: 16px; flex-wrap: wrap; }
        .pay-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; min-width: 160px; }
        .pay-bar { position: sticky; bottom: 0; background: #fff; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 16px; padding: 14px 24px; }
        .pay-bar span { color: #f97316; font-weight: 700; margin-left: 6px; }
        .btn { appearance: none; border: none; background: #2563eb; color: #fff; padding: 10px 22px; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .btn.secondary { background: #fff; border: 1px solid #cbd5f5; color: #2563eb; }
        .hint { color: #666; font-size: 12px; }
        .field { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .field span { width:110px; font-size:12px; color:#555; }
        .field input, .field select { flex:1; padding:6px 8px; border:1px solid #e5e7eb; border-radius:6px; }
      </style>
    </head>
    <body>
      <div class="topbar">
        <div class="logo">外部业务系统</div>
        <div class="hint">简体中文 ▾</div>
      </div>

      <div class="container">
        <div class="tab-bar">
          <a class="tab-item ${state.activeTab === 'merchant' ? 'active' : ''}" href="/tabs/merchant">商户配置</a>
          <a class="tab-item ${state.activeTab === 'order' ? 'active' : ''}" href="/tabs/order">下单支付</a>
          <a class="tab-item ${state.activeTab === 'payset' ? 'active' : ''}" href="/tabs/payset">支付记录</a>
        </div>

        <div class="section" style="display:${state.activeTab === 'merchant' ? 'block' : 'none'};">
          <div class="section-title">商户支付配置</div>
          <div class="sub-tabs">
            <a class="sub-tab ${state.platformTab === 'alipay' ? 'active' : ''}" href="/tabs/platform/alipay">支付宝</a>
            <a class="sub-tab ${state.platformTab === 'wechat' ? 'active' : ''}" href="/tabs/platform/wechat">微信</a>
          </div>
          <form method="post" action="/actions/config-merchant">
            <div style="margin-bottom:12px;">
              <div class="field">
                <span>配置模板</span>
                <select name="preset">
                  <option value="custom" ${state.preset === 'custom' ? 'selected' : ''}>自定义</option>
                  <option value="mock_wechat" ${state.preset === 'mock_wechat' ? 'selected' : ''}>Mock-微信</option>
                  <option value="mock_alipay" ${state.preset === 'mock_alipay' ? 'selected' : ''}>Mock-支付宝</option>
                  <option value="mock_both" ${state.preset === 'mock_both' ? 'selected' : ''}>Mock-微信+支付宝</option>
                </select>
              </div>
            </div>
            <div style="display:flex; gap:16px; flex-wrap:wrap;">
              <div style="flex:1 1 320px; display:${state.platformTab === 'wechat' ? 'block' : 'none'};">
                <div style="font-weight:700; margin-bottom:8px;">微信支付</div>
                <div class="field"><span>mchId</span><input name="wechat_mchId" value="${escapeHtml(wx.mchId)}" /></div>
                <div class="field"><span>appId</span><input name="wechat_appId" value="${escapeHtml(wx.appId)}" /></div>
                <div class="field"><span>apiKeyV3</span><input name="wechat_apiKeyV3" value="${escapeHtml(wx.apiKeyV3)}" /></div>
                <div class="field"><span>certSerialNo</span><input name="wechat_certSerialNo" value="${escapeHtml(wx.certSerialNo)}" /></div>
                <div class="field"><span>privateKey</span><input name="wechat_privateKey" value="${escapeHtml(wx.privateKey)}" /></div>
              </div>
              <div style="flex:1 1 320px; display:${state.platformTab === 'alipay' ? 'block' : 'none'};">
                <div style="font-weight:700; margin-bottom:8px;">支付宝</div>
                <div class="field"><span>appId</span><input name="alipay_appId" value="${escapeHtml(ali.appId)}" /></div>
                <div class="field"><span>privateKey</span><input name="alipay_privateKey" value="${escapeHtml(ali.privateKey)}" /></div>
                <div class="field"><span>alipayPublicKey</span><input name="alipay_alipayPublicKey" value="${escapeHtml(
                  ali.alipayPublicKey,
                )}" /></div>
                <div class="field"><span>signType</span><input name="alipay_signType" value="${escapeHtml(ali.signType)}" /></div>
              </div>
            </div>
            <div style="margin-top:12px;">
              <button class="btn secondary" type="submit">保存商户配置到收银系统</button>
            </div>
          </form>
          <div class="hint" style="margin-top:8px;">保存后由外部系统通过 SDK 调用收银系统配置商户支付信息。</div>
        </div>

        <div class="section" style="display:${state.activeTab === 'order' ? 'block' : 'none'};">
          <div class="section-title">待支付订单</div>
          <div class="amount">应付：<span>¥ ${(product.unitPrice / 100).toFixed(2)}</span></div>
          <table>
            <thead>
              <tr>
                <th>订单号</th>
                <th>产品</th>
                <th>配置</th>
                <th>数量</th>
                <th>时长</th>
                <th>总应付金额</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(latest?.orderId || '--')}</td>
                <td>${escapeHtml(product.title)}</td>
                <td>${escapeHtml(product.description)}</td>
                <td>1</td>
                <td>${escapeHtml(product.duration)}</td>
                <td>¥ ${(product.unitPrice / 100).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section" style="display:${state.activeTab === 'order' ? 'block' : 'none'};">
          <div class="section-title">支付方式</div>
          <div class="hint">支付方式由收银台自动识别，不需要在外部系统选择。</div>
        </div>

        <div class="section" style="display:${state.activeTab === 'payset' ? 'block' : 'none'};">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div class="section-title" style="margin-bottom:0;">支付记录列表</div>
            <div class="hint">数据来源：收银平台 · 同步时间：${state.paysetSnapshot?.ts ? new Date(state.paysetSnapshot.ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '-'}</div>
          </div>
          ${state.paysetError ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;margin-bottom:10px;color:#dc2626;font-size:13px;">同步失败：${escapeHtml(state.paysetError)}</div>` : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <form method="post" action="/actions/sync-payset">
              <button class="btn secondary" type="submit">刷新支付记录</button>
            </form>
            <div class="hint">共 ${state.paysetSnapshot?.data?.total ?? 0} 条记录</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>订单号</th>
                <th>外部订单号</th>
                <th>商品名称</th>
                <th style="text-align:right;">金额</th>
                <th>支付渠道</th>
                <th>状态</th>
                <th>支付时间</th>
              </tr>
            </thead>
            <tbody>
              ${renderPaysetRows()}
            </tbody>
          </table>
          ${(() => {
            const total = state.paysetSnapshot?.data?.total ?? 0;
            const totalPages = Math.ceil(total / state.paysetPageSize) || 1;
            const page = state.paysetPage;
            if (total <= state.paysetPageSize) return '';
            return `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;">
              ${page > 1 ? `<form method="post" action="/actions/payset-page" style="display:inline;"><input type="hidden" name="page" value="${page - 1}" /><button class="btn secondary" type="submit" style="padding:6px 14px;">上一页</button></form>` : `<button class="btn secondary" disabled style="padding:6px 14px;opacity:0.4;">上一页</button>`}
              <span class="hint">第 ${page} / ${totalPages} 页</span>
              ${page < totalPages ? `<form method="post" action="/actions/payset-page" style="display:inline;"><input type="hidden" name="page" value="${page + 1}" /><button class="btn secondary" type="submit" style="padding:6px 14px;">下一页</button></form>` : `<button class="btn secondary" disabled style="padding:6px 14px;opacity:0.4;">下一页</button>`}
            </div>`;
          })()}
        </div>
      </div>

      <div class="pay-bar" style="display:${state.activeTab === 'order' ? 'flex' : 'none'};">
        <div>支付金额：<span>¥ ${(product.unitPrice / 100).toFixed(2)}</span></div>
        <form method="post" action="/actions/pay">
          <input type="hidden" name="productId" value="${escapeHtml(product.productId)}" />
          <button class="btn" type="submit">支付</button>
        </form>
      </div>
    </body>
  </html>`;
}

function renderResultPage(order) {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>支付结果</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #111; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
        .btn { appearance: none; border: 1px solid #111; background: #111; color: #fff; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; }
      </style>
    </head>
    <body>
      <h1>支付结果</h1>
      <div class="card">
        <div><b>订单号:</b> ${escapeHtml(order?.orderId || '')}</div>
        <div><b>状态:</b> ${escapeHtml(order?.status || 'unknown')}</div>
        <div><b>金额:</b> ${order ? (order.amount / 100).toFixed(2) : '-'}</div>
      </div>
      <a class="btn" href="/">返回业务系统</a>
    </body>
  </html>`;
}

function redirect(res, location) {
  res.writeHead(303, { location });
  res.end();
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

async function readBodyText(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function parseForm(bodyText) {
  const out = {};
  for (const part of bodyText.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v.replaceAll('+', ' '));
  }
  return out;
}

async function readJsonBody(req) {
  const raw = await readBodyText(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

    if (req.method === 'POST' && url.pathname === '/actions/bootstrap') {
      await bootstrapMerchant();
      redirect(res, '/');
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/tabs/')) {
      const parts = url.pathname.split('/');
      if (parts[2] === 'platform') {
        const tab = parts[3];
        state.platformTab = tab === 'wechat' ? 'wechat' : 'alipay';
      } else {
        const tab = parts[2] || parts[1];
        state.activeTab = tab === 'merchant' ? 'merchant' : tab === 'payset' ? 'payset' : 'order';
        const orderId = url.searchParams.get('orderId') || '';
        state.highlightOrderId = orderId;
        if (state.activeTab === 'payset') {
          if (!orderId) state.paysetPage = 1;
          await syncPayset();
        }
      }
      redirect(res, '/');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/actions/config-merchant') {
      const bodyText = await readBodyText(req);
      const form = parseForm(bodyText);
      if (!state.merchant) await bootstrapMerchant();

      const preset = form.preset || 'custom';
      state.preset = preset;
      const presetConfig = PRESETS[preset] || null;
      if (preset === 'mock_wechat') state.platformTab = 'wechat';
      if (preset === 'mock_alipay') state.platformTab = 'alipay';
      if (preset === 'mock_both' && state.platformTab !== 'wechat') state.platformTab = 'alipay';

      const wechat = {
        mchId: presetConfig?.wechat?.mchId || form.wechat_mchId || '',
        appId: presetConfig?.wechat?.appId || form.wechat_appId || '',
        apiKeyV3: presetConfig?.wechat?.apiKeyV3 || form.wechat_apiKeyV3 || '',
        certSerialNo: presetConfig?.wechat?.certSerialNo || form.wechat_certSerialNo || '',
        privateKey: presetConfig?.wechat?.privateKey || form.wechat_privateKey || '',
      };
      const alipay = {
        appId: presetConfig?.alipay?.appId || form.alipay_appId || '',
        privateKey: presetConfig?.alipay?.privateKey || form.alipay_privateKey || '',
        alipayPublicKey: presetConfig?.alipay?.alipayPublicKey || form.alipay_alipayPublicKey || '',
        signType: presetConfig?.alipay?.signType || form.alipay_signType || 'RSA2',
      };

      state.merchantConfig.wechat = wechat;
      state.merchantConfig.alipay = alipay;

      const payload = {};
      if (state.platformTab === 'wechat' && (wechat.mchId || wechat.appId || wechat.apiKeyV3 || wechat.privateKey)) {
        payload.wechat = wechat;
      }
      if (state.platformTab === 'alipay' && (alipay.appId || alipay.privateKey || alipay.alipayPublicKey)) {
        payload.alipay = alipay;
      }

      if (payload.wechat || payload.alipay) {
        await sdk.configurePayment(state.merchant.merchantId, payload);
        logLine('Merchant payment config updated via SDK.', payload);
      }
      state.activeTab = 'merchant';
      redirect(res, '/');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/actions/pay') {
      if (!state.merchant) await bootstrapMerchant();
      const bodyText = await readBodyText(req);
      const form = parseForm(bodyText);
      const order = createBusinessOrder(form.productId);
      logLine('Business order created, redirecting to cashier.', { orderId: order.orderId });
      const cashierUrl = `${CASHIER_CLIENT_BASE_URL}/external?merchantId=${state.merchant.merchantId}&externalOrderId=${order.orderId}`;
      redirect(res, cashierUrl);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/actions/sync-payset') {
      state.paysetPage = 1;
      await syncPayset();
      state.activeTab = 'payset';
      redirect(res, '/');
      return;
    }

    if (req.method === 'POST' && url.pathname === '/actions/payset-page') {
      const bodyText = await readBodyText(req);
      const form = parseForm(bodyText);
      const page = Number(form.page);
      if (page >= 1) state.paysetPage = page;
      await syncPayset();
      state.activeTab = 'payset';
      redirect(res, '/');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/result') {
      const orderId = url.searchParams.get('orderId') || '';
      const order = findOrder(orderId);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderResultPage(order));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/callbacks/payment') {
      const body = await readJsonBody(req);
      state.callbacks.unshift({
        ts: new Date().toISOString(),
        orderId: body.orderId,
        status: body.status,
        amount: body.amount,
      });
      state.callbacks = state.callbacks.slice(0, 50);
      const order = findOrder(body.externalOrderId || body.orderId);
      if (order) {
        order.status = body.status || order.status;
        order.updatedAt = new Date().toISOString();
      }
      state.paymentRecords.unshift({
        ts: new Date().toISOString(),
        orderId: body.orderId,
        status: body.status,
        amount: body.amount,
      });
      logLine('Received payment callback from cashier server.', body);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/orders/')) {
      const orderId = url.pathname.split('/').pop();
      const order = findOrder(orderId);
      if (!order) {
        sendJson(res, 404, { error: 'order_not_found' });
        return;
      }
      const payload = {
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        subject: order.subject,
        description: order.description,
        expireMinutes: 30,
        notifyUrl: callbackUrl(),
        returnUrl: paysetUrl(order.orderId),
        metadata: {
          productId: order.productId,
        },
        items: [
          {
            productId: order.productId,
            title: order.subject,
            description: order.description,
            price: order.amount,
            quantity: 1,
            duration: order.duration,
          },
        ],
      };
      const sign = signOrderSnapshot(payload, state.sharedSecret);
      sendJson(res, 200, { ...payload, ...sign });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderPage());
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  } catch (err) {
    logLine('Request failed.', { error: err?.message || String(err) });
    sendJson(res, 500, { error: err?.message || String(err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  logLine(`External biz server running at http://127.0.0.1:${PORT}`);
});
