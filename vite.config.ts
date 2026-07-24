import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const appVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'public/version.json'), 'utf-8')
).version as string;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script',
        manifest: {
          name: 'FunkyFood',
          short_name: 'FunkyFood',
          description: 'FunkyFood POS',
          theme_color: '#111827',
          background_color: '#111827',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          // @ts-ignore - gcm_sender_id is required for FCM even if not in standard PWA types
          icons: [
            {
              src: 'icon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
