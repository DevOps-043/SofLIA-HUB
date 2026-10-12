import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ define: { "process.env.NODE_ENV": JSON.stringify("production") }, plugins: [react()], build: { outDir: 'dist/presentation', emptyOutDir: true, lib: { entry: 'src/presentation-runtime/standalone.tsx', name: 'PulsePresentation', formats: ['iife'], fileName: () => 'presentation-runtime.iife.js', cssFileName: 'presentation-runtime' }, rolldownOptions: { output: { inlineDynamicImports: true } } } });
