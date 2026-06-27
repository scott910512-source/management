import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 시 /api 요청을 Express 서버(4000)로 프록시한다. 동일 출처라 쿠키 세션이 그대로 동작한다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    css: false,
  },
});
