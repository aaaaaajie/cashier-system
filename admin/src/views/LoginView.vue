<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../api/auth';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const form = reactive({
  username: 'admin',
  password: 'admin123',
});

const loading = ref(false);
const errorText = ref('');

async function onSubmit() {
  errorText.value = '';
  loading.value = true;
  try {
    const res = await login({ username: form.username, password: form.password });
    auth.username = form.username;
    auth.setToken(res.accessToken);

    const redirect = (route.query.redirect as string) || '/dashboard';
    router.push(redirect);
  } catch (err: any) {
    errorText.value = err?.message || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-shell">
    <div class="card login-card">
      <div class="page-header" style="margin-bottom: 12px">
        <div>
          <h1 class="page-title">管理后台登录</h1>
          <p class="page-desc">使用 JWT 管理接口进行登录和鉴权</p>
        </div>
      </div>

      <div class="grid" style="gap: 10px">
        <label class="grid">
          <span class="hint">用户名</span>
          <input v-model="form.username" placeholder="admin" />
        </label>

        <label class="grid">
          <span class="hint">密码</span>
          <input v-model="form.password" type="password" placeholder="••••••••" />
        </label>

        <button :disabled="loading" @click="onSubmit">
          {{ loading ? "登录中..." : "登录" }}
        </button>

        <div class="hint">
          默认账号：`ADMIN_USERNAME` / `ADMIN_PASSWORD`
        </div>
        <div v-if="errorText" class="error-text">{{ errorText }}</div>
      </div>
    </div>
  </div>
</template>

