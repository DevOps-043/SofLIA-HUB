import fs from 'node:fs';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

// Sólo descarga; el consumidor verifica SHA256 antes de extraer o ejecutar.
export async function download(url, destination, redirects = 0) {
  if (redirects > 5 || new URL(url).protocol !== 'https:') throw new Error('Redirección Python no permitida.');
  const response = await new Promise((resolve, reject) => {
    const request = https.get(url, resolve);
    request.setTimeout(60000, () => request.destroy(new Error('Descarga Python sin respuesta.')));
    request.on('error', reject);
  });
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    response.resume();
    return download(new URL(response.headers.location, url).href, destination, redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`Descarga Python: HTTP ${response.statusCode}.`);
  }
  let received = 0;
  const quota = new Transform({ transform(chunk, _encoding, done) {
    received += chunk.length;
    done(received > 512 * 1024 * 1024 ? new Error('El archivo Python supera 512 MiB.') : null, chunk);
  } });
  await pipeline(response, quota, fs.createWriteStream(destination, { flags: 'wx' }), { signal: AbortSignal.timeout(15 * 60 * 1000) });
}

