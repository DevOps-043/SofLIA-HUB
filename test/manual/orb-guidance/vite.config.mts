import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), envDir: false, plugins: [react()],
  css: { postcss: { plugins: [tailwind()] } },
  server: { host: '127.0.0.1', port: 4321, strictPort: true, watch: { ignored: ['**/work/**'] }, fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } },
});
