import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), envDir: false, publicDir: false,
  plugins: [react(), { name: 'inicio-nativo-qa', configureServer(server) {
    server.middlewares.use('/native-home', async (_request, response, next) => {
      try {
        const module = await server.ssrLoadModule(fileURLToPath(new URL('../../../electron/integrated-browser/home/protocol.ts', import.meta.url)));
        const document = module.resolveBrowserHomeRequest({ url: 'soflia-inicio://inicio/', method: 'GET' });
        document.headers.forEach((value: string, name: string) => response.setHeader(name, value));
        response.end(await document.text());
      } catch (error) { next(error as Error); }
    });
  } }],
  css: { postcss: { plugins: [tailwind()] } },
  server: { host: '127.0.0.1', port: 4331, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } },
});
