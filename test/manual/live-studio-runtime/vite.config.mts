import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { studioTestServer } from './server';
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), envDir: false, plugins: [react(), studioTestServer()], server: { host: '127.0.0.1', port: 4321, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } } });
