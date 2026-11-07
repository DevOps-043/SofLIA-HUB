import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { zoomVideoAssets } from './config/vite/zoom-video-assets.mjs';
export default defineConfig({
  root: fileURLToPath(new URL('./packages/zoom-runtime/', import.meta.url)), base: './', envDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [zoomVideoAssets(true)],
  build: { outDir: '../../dist/zoom-runtime', emptyOutDir: true },
});
