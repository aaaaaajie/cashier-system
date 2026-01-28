import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const TOKEN_KEY = 'cashier_admin_token';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('');
  const username = ref<string>('admin');

  const isAuthed = computed(() => Boolean(token.value));

  function init() {
    if (!token.value) {
      token.value = localStorage.getItem(TOKEN_KEY) || '';
    }
  }

  function setToken(nextToken: string) {
    token.value = nextToken;
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function logout() {
    setToken('');
  }

  return { token, username, isAuthed, init, setToken, logout };
});

