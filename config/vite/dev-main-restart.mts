import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Reinicia Electron sólo cuando cambió el código emitido, sin arranques solapados. */
export function createMainProcessRestart(start: () => Promise<void>): {
  plugin: Plugin;
  startIfChanged: () => Promise<void>;
} {
  let fingerprint: string | null = null;
  let scheduled: string | null = null;
  let started: string | null = null;
  let pending = Promise.resolve();

  return {
    plugin: {
      name: 'soflia-main-restart',
      generateBundle(_, bundle) {
        const hash = createHash('sha256');
        for (const fileName of Object.keys(bundle).sort()) {
          const output = bundle[fileName];
          const content = output.type === 'chunk' ? output.code : output.source;
          hash.update(JSON.stringify([fileName, output.type, content.length]));
          hash.update(content);
        }
        fingerprint = hash.digest('hex');
      },
    },
    startIfChanged() {
      if (!fingerprint) return Promise.reject(new Error('El bundle main aún no está listo.'));
      if (scheduled === fingerprint) return pending;
      const target = fingerprint;
      scheduled = target;
      // Un fallo anterior se entrega a su caller; no bloquea el siguiente intento.
      pending = pending.catch(() => {}).then(async () => {
        if (started === target) return;
        // El intento puede cerrar el hijo anterior antes de fallar.
        started = null;
        await start();
        started = target;
      }).catch((error: unknown) => {
        if (scheduled === target) scheduled = null;
        throw error;
      });
      return pending;
    },
  };
}
