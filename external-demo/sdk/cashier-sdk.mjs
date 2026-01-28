import crypto from 'crypto';

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

async function requestJson(baseUrl, path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, init);
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

export class CashierSdk {
  constructor(options) {
    this.baseUrl = (options.baseUrl || 'http://localhost:3000').replace(/\/+$/, '');
    this.adminUsername = options.adminUsername || 'admin';
    this.adminPassword = options.adminPassword || 'admin123';

    this.adminToken = '';
    this.merchant = null;
  }

  async adminLogin() {
    const envelope = await requestJson(this.baseUrl, '/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: this.adminUsername, password: this.adminPassword }),
    });
    const login = unwrapEnvelope(envelope);
    this.adminToken = login.accessToken;
    return login;
  }

  async ensureAdminToken() {
    if (this.adminToken) return this.adminToken;
    await this.adminLogin();
    return this.adminToken;
  }

  async createMerchant({ name, callbackUrl }) {
    const adminToken = await this.ensureAdminToken();
    const envelope = await requestJson(this.baseUrl, '/api/v1/admin/merchants', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name, callbackUrl, ipWhitelist: [] }),
    });
    const merchant = unwrapEnvelope(envelope);
    this.merchant = merchant;
    return merchant;
  }

  async configurePayment(merchantId, payload) {
    const adminToken = await this.ensureAdminToken();
    const envelope = await requestJson(this.baseUrl, `/api/v1/admin/merchants/${merchantId}/payment-config`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    return unwrapEnvelope(envelope);
  }

  async configureExternal(merchantId, payload) {
    const adminToken = await this.ensureAdminToken();
    const envelope = await requestJson(this.baseUrl, `/api/v1/admin/merchants/${merchantId}/external-config`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    return unwrapEnvelope(envelope);
  }

  signedHeaders(params = {}) {
    if (!this.merchant) {
      const err = new Error('merchant_not_ready');
      err.statusCode = 400;
      throw err;
    }
    return signedHeaders(this.merchant.appKey, this.merchant.appSecret, params);
  }

  async upsertProduct(payload) {
    const headers = this.signedHeaders(payload);
    const envelope = await requestJson(this.baseUrl, '/api/v1/products/upsert', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return unwrapEnvelope(envelope);
  }

  async getPayment(paymentId) {
    const headers = this.signedHeaders({});
    const envelope = await requestJson(this.baseUrl, `/api/v1/payments/${paymentId}`, {
      method: 'GET',
      headers,
    });
    return unwrapEnvelope(envelope);
  }

  async queryPayset(params = {}) {
    const headers = this.signedHeaders({});
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      query.set(key, String(value));
    }
    const suffix = query.toString();
    const envelope = await requestJson(this.baseUrl, `/api/v1/payset${suffix ? `?${suffix}` : ''}`, {
      method: 'GET',
      headers,
    });
    return unwrapEnvelope(envelope);
  }
}
