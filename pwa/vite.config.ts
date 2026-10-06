import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Strict CSP for production builds only (the Vite dev server relies on inline scripts for HMR).
const contentSecurityPolicy: Plugin = {
  name: 'bonsai-chef-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' blob: data:",
          "connect-src 'self'",
          "worker-src 'self'",
          "manifest-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join('; '),
      },
      injectTo: 'head-prepend',
    },
  ],
};

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    contentSecurityPolicy,
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Bonsai Chef',
        short_name: 'Bonsai Chef',
        description: 'Il diario per la cura dei tuoi bonsai: rinvaso, potatura, concimazione, strumenti e promemoria.',
        lang: 'it',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#f2f2f7',
        categories: ['lifestyle', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Aggiungi Bonsai', short_name: 'Nuovo bonsai', url: '/bonsai/nuovo', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Aggiungi Strumento', short_name: 'Nuovo strumento', url: '/strumenti/nuovo', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,ico,webmanifest}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
    // Database tests need Postgres: `npm run test:db`.
    exclude: ['tests/db/**', 'node_modules/**'],
  },
});
