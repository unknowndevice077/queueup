/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

// Absolute URL for link-preview images; Facebook ignores relative og:image paths.
process.env.VITE_SITE_URL ??= 'https://queueupph.vercel.app';

/**
 * Link previews are read from static HTML (crawlers do not run the SPA), so pages shared on their own get a copy
 * of index.html with their own title, description and image, served at that path.
 */
const SHARE_PAGES: { path: string; title: string; description: string; image: string }[] = [
  {
    path: 'abroad',
    title: "Book Mama's check-up from abroad. Know she actually went. | QueueUp",
    description:
      "For OFWs: book and pay for your family's clinic visit back home, and get the receipt and the doctor's note when it's done.",
    image: '/og/abroad.png',
  },
];

function sharePages(): Plugin {
  return {
    name: 'queueup-share-pages',
    apply: 'build',
    closeBundle() {
      const site = process.env.VITE_SITE_URL;
      const base = readFileSync('dist/index.html', 'utf8');
      for (const page of SHARE_PAGES) {
        const html = base
          .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
          .replace(/(<meta name="description" content=")[^"]*"/, `$1${page.description}"`)
          .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${page.title}"`)
          .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${page.description}"`)
          .replace(/(<meta property="og:image" content=")[^"]*"/, `$1${site}${page.image}"`)
          .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${site}/${page.path}"`);
        mkdirSync(`dist/${page.path}`, { recursive: true });
        writeFileSync(`dist/${page.path}/index.html`, html);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), sharePages()],
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
