import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./packages/zoom-runtime/', import.meta.url)), base: './', envDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: { outDir: '../../dist/zoom-runtime', emptyOutDir: true },
});
