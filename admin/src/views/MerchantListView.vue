<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  configurePayment,
  createMerchant,
  listMerchants,
  updateMerchant,
  type MerchantItem,
} from '../api/merchant';

const loading = ref(false);
const errorText = ref('');
const merchants = ref<MerchantItem[]>([]);
const total = ref(0);

const query = reactive({
  keyword: '',
  status: '',
  page: 1,
  pageSize: 20,
});

const createForm = reactive({
  name: '',
  callbackUrl: '',
  ipWhitelistText: '',
});

const configForm = reactive({
  merchantId: '',
  wechatMchId: '',
  wechatAppId: '',
  wechatApiKeyV3: '',
  wechatCertSerialNo: '',
  wechatPrivateKey: '',
  alipayAppId: '',
  alipayPrivateKey: '',
  alipayPublicKey: '',
});

async function load() {
  loading.value = true;
  errorText.value = '';
  try {
    const res = await listMerchants({
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    merchants.value = res.data;
    total.value = res.total;
  } catch (err: any) {
    errorText.value = err?.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

async function onCreate() {
  if (!createForm.name.trim()) {
    errorText.value = '请填写商户名称';
    return;
  }
  loading.value = true;
  errorText.value = '';
  try {
    const ipWhitelist = createForm.ipWhitelistText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    await createMerchant({
      name: createForm.name.trim(),
      callbackUrl: createForm.callbackUrl || undefined,
      ipWhitelist: ipWhitelist.length ? ipWhitelist : undefined,
    });
    createForm.name = '';
    createForm.callbackUrl = '';
    createForm.ipWhitelistText = '';
    await load();
  } catch (err: any) {
    errorText.value = err?.message || '创建失败';
  } finally {
    loading.value = false;
  }
}

function fillConfigForm(item: MerchantItem) {
  configForm.merchantId = item.merchantId;
  configForm.wechatMchId = '';
  configForm.wechatAppId = '';
  configForm.wechatApiKeyV3 = '';
  configForm.wechatCertSerialNo = '';
  configForm.wechatPrivateKey = '';
  configForm.alipayAppId = '';
  configForm.alipayPrivateKey = '';
  configForm.alipayPublicKey = '';
}

async function onUpdateName(item: MerchantItem) {
  const nextName = prompt('新的商户名称', item.name);
  if (!nextName || nextName === item.name) return;
  loading.value = true;
  errorText.value = '';
  try {
    await updateMerchant(item.merchantId, { name: nextName });
    await load();
  } catch (err: any) {
    errorText.value = err?.message || '更新失败';
  } finally {
    loading.value = false;
  }
}

async function onSubmitConfig() {
  if (!configForm.merchantId) {
    errorText.value = '请先选择要配置的商户';
    return;
  }
  loading.value = true;
  errorText.value = '';
  try {
    const payload: any = {};
    if (configForm.wechatAppId && configForm.wechatMchId) {
      payload.wechat = {
        mchId: configForm.wechatMchId,
        appId: configForm.wechatAppId,
        apiKeyV3: configForm.wechatApiKeyV3,
        certSerialNo: configForm.wechatCertSerialNo,
        privateKey: configForm.wechatPrivateKey,
      };
    }
    if (configForm.alipayAppId) {
      payload.alipay = {
        appId: configForm.alipayAppId,
        privateKey: configForm.alipayPrivateKey,
        alipayPublicKey: configForm.alipayPublicKey,
        signType: 'RSA2',
      };
    }
    await configurePayment(configForm.merchantId, payload);
    await load();
  } catch (err: any) {
    errorText.value = err?.message || '配置失败';
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
        <h1 class="page-title">商户管理</h1>
        <p class="page-desc">创建商户、获取 AppKey / AppSecret、配置支付渠道</p>
      </div>
      <button class="secondary" :disabled="loading" @click="load">
        {{ loading ? "刷新中..." : "刷新" }}
      </button>
    </div>

    <div class="card">
      <div class="toolbar">
        <input v-model="query.keyword" placeholder="搜索 merchantId / name / appKey" />
        <select v-model="query.status">
          <option value="">全部状态</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
          <option value="pending">pending</option>
        </select>
        <button class="secondary" :disabled="loading" @click="load">查询</button>
      </div>

      <div class="hint" style="margin-bottom: 10px">共 {{ total }} 个商户</div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>merchantId</th>
              <th>名称</th>
              <th>appKey</th>
              <th>appSecret</th>
              <th>状态</th>
              <th>回调地址</th>
              <th>微信商户</th>
              <th>支付宝</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in merchants" :key="item.merchantId">
              <td>{{ item.merchantId }}</td>
              <td>{{ item.name }}</td>
              <td>{{ item.appKey }}</td>
              <td>{{ item.appSecret || "-" }}</td>
              <td><span class="badge" :class="item.status">{{ item.status }}</span></td>
              <td>{{ item.callbackUrl || "-" }}</td>
              <td>{{ item.paymentConfig?.wechat?.mchId || "-" }}</td>
              <td>{{ item.paymentConfig?.alipay?.appId || "-" }}</td>
              <td style="display: flex; gap: 6px">
                <button class="secondary" @click="fillConfigForm(item)">配置渠道</button>
                <button class="secondary" @click="onUpdateName(item)">改名</button>
              </td>
            </tr>
            <tr v-if="!loading && merchants.length === 0">
              <td colspan="9" class="hint">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom: 10px">
        <div>
          <h2 class="page-title" style="font-size: 18px">创建商户</h2>
          <p class="page-desc">创建后会返回一次性明文 appSecret</p>
        </div>
      </div>
      <div class="grid">
        <div class="form-row single">
          <label class="grid">
            <span class="hint">商户名称</span>
            <input v-model="createForm.name" placeholder="例如：SaaS 平台 A" />
          </label>
        </div>
        <div class="form-row single">
          <label class="grid">
            <span class="hint">默认回调地址（可选）</span>
            <input v-model="createForm.callbackUrl" placeholder="https://example.com/callback" />
          </label>
        </div>
        <div class="form-row single">
          <label class="grid">
            <span class="hint">IP 白名单（每行一个，可选）</span>
            <textarea v-model="createForm.ipWhitelistText" rows="4" placeholder="203.0.113.10"></textarea>
          </label>
        </div>
        <div>
          <button :disabled="loading" @click="onCreate">
            {{ loading ? "提交中..." : "创建商户" }}
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="page-header" style="margin-bottom: 10px">
        <div>
          <h2 class="page-title" style="font-size: 18px">配置支付渠道</h2>
          <p class="page-desc">先从列表中点“配置渠道”选择商户</p>
        </div>
      </div>

      <div class="hint" style="margin-bottom: 8px">
        当前商户：{{ configForm.merchantId || "未选择" }}
      </div>

      <div class="grid" style="gap: 16px">
        <div class="card" style="padding: 14px">
          <div class="hint" style="margin-bottom: 8px">微信支付</div>
          <div class="form-row">
            <label class="grid">
              <span class="hint">mchId</span>
              <input v-model="configForm.wechatMchId" />
            </label>
            <label class="grid">
              <span class="hint">appId</span>
              <input v-model="configForm.wechatAppId" />
            </label>
          </div>
          <div class="form-row single" style="margin-top: 8px">
            <label class="grid">
              <span class="hint">apiKeyV3</span>
              <input v-model="configForm.wechatApiKeyV3" />
            </label>
          </div>
          <div class="form-row single" style="margin-top: 8px">
            <label class="grid">
              <span class="hint">certSerialNo</span>
              <input v-model="configForm.wechatCertSerialNo" />
            </label>
          </div>
          <div class="form-row single" style="margin-top: 8px">
            <label class="grid">
              <span class="hint">privateKey</span>
              <textarea v-model="configForm.wechatPrivateKey" rows="3"></textarea>
            </label>
          </div>
        </div>

        <div class="card" style="padding: 14px">
          <div class="hint" style="margin-bottom: 8px">支付宝</div>
          <div class="form-row single">
            <label class="grid">
              <span class="hint">appId</span>
              <input v-model="configForm.alipayAppId" />
            </label>
          </div>
          <div class="form-row single" style="margin-top: 8px">
            <label class="grid">
              <span class="hint">privateKey</span>
              <textarea v-model="configForm.alipayPrivateKey" rows="3"></textarea>
            </label>
          </div>
          <div class="form-row single" style="margin-top: 8px">
            <label class="grid">
              <span class="hint">alipayPublicKey</span>
              <textarea v-model="configForm.alipayPublicKey" rows="3"></textarea>
            </label>
          </div>
        </div>

        <div>
          <button :disabled="loading" @click="onSubmitConfig">
            {{ loading ? "提交中..." : "提交配置" }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="errorText" class="card">
      <div class="error-text">{{ errorText }}</div>
    </div>
  </section>
</template>
