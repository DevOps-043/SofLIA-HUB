import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') }, plugins: [react()],
  build: { outDir: 'dist/audiovisual', emptyOutDir: true, lib: { entry: 'src/audiovisual-runtime/standalone.tsx', name: 'PulseFilm', formats: ['iife'], fileName: () => 'film-runtime.iife.js', cssFileName: 'film-runtime' }, rolldownOptions: { output: { inlineDynamicImports: true } } },
});
