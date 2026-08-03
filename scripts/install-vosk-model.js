// =============================================================================
// Pulse Hub - Descarga on-demand del modelo Vosk español (voz pasiva local)
// =============================================================================
// Sigue el mismo patron que install-omniparser-model.js: el modelo NO se
// bundlea en el instalador (evita +40 MB); se descarga bajo demanda.
// Modelo: vosk-model-small-es-0.42 (Apache-2.0, ~39 MB zip / ~58 MB extraido).
// Uso: node scripts/install-vosk-model.js [--force]
// =============================================================================
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MODEL_NAME = 'vosk-model-small-es-0.42';
const MODEL_URL = process.env.VOSK_MODEL_URL
  || `https://alphacephei.com/vosk/models/${MODEL_NAME}.zip`;
const TARGET_DIR = process.env.VOSK_MODEL_TARGET
  || path.join(process.cwd(), 'models', MODEL_NAME);

async function main() {
  const force = process.argv.includes('--force');
  console.log('');
  console.log('MODELO VOSK ESPAÑOL (voz pasiva local)');
  console.log(`Licencia Apache-2.0. Fuente: ${MODEL_URL}`);
  console.log('');

  if (fs.existsSync(path.join(TARGET_DIR, 'conf')) && !force) {
    console.log(`[Vosk] Modelo ya existe: ${TARGET_DIR}`);
    console.log('[Vosk] Usa -- --force para descargarlo de nuevo.');
    return;
  }

  const parentDir = path.dirname(TARGET_DIR);
  fs.mkdirSync(parentDir, { recursive: true });
  // Expand-Archive exige extension .zip, por eso el temporal termina en .zip
  const zipPath = path.join(parentDir, `${MODEL_NAME}.download.zip`);
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });

  console.log(`[Vosk] Descargando modelo (~39 MB) a: ${TARGET_DIR}`);
  await downloadFile(MODEL_URL, zipPath, 0);

  console.log('[Vosk] Extrayendo...');
  if (fs.existsSync(TARGET_DIR)) fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  // El zip contiene una carpeta raiz con el nombre del modelo; extraer en models/
  // (PowerShell y no tar: bsdtar interpreta rutas "C:\" como host remoto)
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${parentDir}" -Force`], { stdio: 'inherit' });
  fs.rmSync(zipPath, { force: true });

  if (!fs.existsSync(path.join(TARGET_DIR, 'conf'))) {
    throw new Error(`La extraccion no produjo el directorio esperado: ${TARGET_DIR}`);
  }
  console.log('[Vosk] Modelo instalado correctamente.');
}

function downloadFile(url, dest, redirects) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error(`Demasiadas redirecciones para ${url}`));
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.rmSync(dest, { force: true });
        return resolve(downloadFile(res.headers.location, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.rmSync(dest, { force: true });
        return reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.rmSync(dest, { force: true });
      reject(err);
    });
  });
}

main().catch((err) => {
  console.error(`[Vosk] Error: ${err.message}`);
  process.exit(1);
});
