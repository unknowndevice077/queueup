/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    proxy: {
      // The dev proxy makes the API same-origin, so the browser's Origin header is dropped instead of
      // tripping the backend's CORS allow-list (which lists the deployed frontend, not every dev port).
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
        configure: (proxy) => proxy.on('proxyReq', (request) => request.removeHeader('origin')),
      },
      '/ws': { target: (process.env.API_PROXY_TARGET ?? 'http://localhost:8080').replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
