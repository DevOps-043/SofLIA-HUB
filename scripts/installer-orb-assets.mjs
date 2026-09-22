import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { ZipArchive } from 'archiver';

export const webViewSdk = Object.freeze({
  version: '1.0.4191.47',
  url: 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4191.47/microsoft.web.webview2.1.0.4191.47.nupkg',
  sha256: 'f492bbf547d0da329553b6727435b677579b1e9f91cc9e4a1ad029366d5f23d0',
});

export async function prepareOrbAssets(root, stage) {
  const cacheDirectory = path.join(os.tmpdir(), 'pulse-installer-sdk-cache');
  fs.mkdirSync(cacheDirectory, { recursive: true });
  assert.ok(!fs.lstatSync(cacheDirectory).isSymbolicLink(), 'La caché SDK no puede ser un enlace.');
  const cached = path.join(cacheDirectory, `webview2-${webViewSdk.version}.zip`);
  const archivePath = path.join(stage, 'webview-sdk.zip');
  if (fs.existsSync(cached)) {
    assert.ok(fs.lstatSync(cached).isFile() && !fs.lstatSync(cached).isSymbolicLink(), 'Caché SDK inválida.');
    fs.copyFileSync(cached, archivePath, fs.constants.COPYFILE_EXCL);
  } else {
    const response = await globalThis.fetch(webViewSdk.url, { signal: globalThis.AbortSignal.timeout(60000), redirect: 'error' });
    assert.ok(response.ok && response.body, 'No se pudo descargar el SDK oficial WebView2.');
    const handle = fs.openSync(archivePath, 'wx');
    let total = 0;
    try {
      for await (const chunk of response.body) {
        total += chunk.byteLength;
        assert.ok(total <= 32 * 1024 * 1024, 'El SDK excede el límite de descarga.');
        fs.writeSync(handle, chunk);
      }
    } finally { fs.closeSync(handle); }
  }
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(archivePath)) hash.update(chunk);
  assert.equal(hash.digest('hex'), webViewSdk.sha256, 'El SDK no coincide con el hash fijado. No se extraerá ni ejecutará.');
  if (!fs.existsSync(cached)) fs.copyFileSync(archivePath, cached, fs.constants.COPYFILE_EXCL);
  const sdk = path.join(stage, 'sdk'); fs.mkdirSync(sdk);
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/tar.exe'), ['-xf', archivePath, '-C', sdk], { windowsHide: true, timeout: 30000 });
  const assets = path.join(stage, 'orb');
  await build({ configFile: false, envDir: false, root: path.join(root, 'build/installer-shell/orb'), base: './', publicDir: false,
    plugins: [react()], css: { postcss: { plugins: [] } },
    build: { outDir: assets, emptyOutDir: false, sourcemap: false, minify: true, chunkSizeWarningLimit: 2000 },
  });
  const archiveFile = path.join(stage, 'orb.zip');
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(archiveFile, { flags: 'wx' });
    const zip = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve); output.on('error', reject); zip.on('error', reject);
    zip.pipe(output); zip.directory(assets, false); zip.file(path.join(sdk, 'LICENSE.txt'), { name: 'WEBVIEW2-LICENSE.txt' });
    for (const name of ['react', 'react-dom', 'three', '@react-three/fiber']) {
      const license = path.join(root, 'node_modules', name, 'LICENSE');
      if (fs.existsSync(license)) zip.file(license, { name: `licenses/${name.replaceAll('/', '-')}.txt` });
    }
    void zip.finalize();
  });
  return { sdk, archiveFile, assets, sdkSha256: webViewSdk.sha256 };
}
