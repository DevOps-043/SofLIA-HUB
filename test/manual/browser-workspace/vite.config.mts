import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Prueba aislada: sin Electron, cuentas, secretos ni archivos de configuración local.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: false,
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 4318, strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
  },
});
