import { cp, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Plugin } from 'vite';

const assets = fileURLToPath(new URL('../../packages/zoom-runtime/node_modules/@zoom/videosdk/dist/lib', import.meta.url));
export function zoomVideoAssets(copyOnBuild = false): Plugin {
  return { name: 'zoom-video-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const match = /^\/(?:packages\/zoom-runtime\/)?lib\/([a-zA-Z0-9_.-]+\.(js|wasm|json|wav))$/.exec((request.url || '').split('?')[0]);
        if (!match) return next();
        try {
          const content = await readFile(path.join(assets, match[1]));
          response.setHeader('Content-Type', match[2] === 'wasm' ? 'application/wasm' : match[2] === 'json' ? 'application/json' : match[2] === 'wav' ? 'audio/wav' : 'text/javascript');
          response.setHeader('Cache-Control', 'no-store'); response.end(content);
        } catch { response.statusCode = 404; response.end('Recurso audiovisual no disponible'); }
      });
    },
    async closeBundle() {
      if (copyOnBuild) await cp(assets, fileURLToPath(new URL('../../dist/zoom-runtime/lib', import.meta.url)), { recursive: true });
    },
  };
}
