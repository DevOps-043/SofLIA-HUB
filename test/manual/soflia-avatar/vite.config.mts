import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), envDir: false, publicDir: false, plugins: [react()],
  css: { postcss: { plugins: [] } },
  server: { host: '127.0.0.1', port: 4330, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } },
});
