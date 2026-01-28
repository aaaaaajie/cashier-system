import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.VITE_CASHIER_PORT || 8080);

  return {
    plugins: [vue()],
    server: {
      port,
      host: '127.0.0.1',
    },
  };
});
