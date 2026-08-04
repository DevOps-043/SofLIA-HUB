// =============================================================================
// Pulse Hub - Descarga on-demand de Piper TTS (binario + voces en español)
// =============================================================================
// Mismo patron que install-vosk-model.js: nada se bundlea en el instalador;
// se descarga bajo demanda a models/piper/ (dev) o userData/models/piper (prod).
//
// - Binario: rhasspy/piper 2023.11.14-2 (MIT), piper_windows_amd64.zip (~21 MB)
// - Voces (~60-75 MB c/u, MIT): huggingface rhasspy/piper-voices (.onnx + .onnx.json)
//
// Uso: node scripts/install-piper-voice.js [voz] [--force]
//      voz por defecto: es_MX-claude-high
// =============================================================================
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PIPER_BIN_URL = process.env.PIPER_BIN_URL
  || 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';

// Catalogo de voces en español soportadas (id → ruta en rhasspy/piper-voices).
const VOICE_CATALOG = {
  'es_MX-claude-high': 'es/es_MX/claude/high/es_MX-claude-high',
  'es_MX-ald-medium': 'es/es_MX/ald/medium/es_MX-ald-medium',
  'es_ES-davefx-medium': 'es/es_ES/davefx/medium/es_ES-davefx-medium',
  'es_ES-sharvard-medium': 'es/es_ES/sharvard/medium/es_ES-sharvard-medium',
};
const HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';

const TARGET_DIR = process.env.PIPER_TARGET_DIR || path.join(process.cwd(), 'models', 'piper');

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--force');
  const force = process.argv.includes('--force');
  const voiceId = args[0] || 'es_MX-claude-high';
  const voicePath = VOICE_CATALOG[voiceId];
  if (!voicePath) {
    console.error(`[Piper] Voz desconocida: '${voiceId}'. Disponibles: ${Object.keys(VOICE_CATALOG).join(', ')}`);
    process.exit(1);
  }

  console.log('');
  console.log('PIPER TTS LOCAL (voz de SofLIA)');
  console.log('Binario MIT (rhasspy/piper) + voces MIT (rhasspy/piper-voices).');
  console.log('');
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  // 1. Binario piper.exe
  const piperExe = path.join(TARGET_DIR, 'piper', 'piper.exe');
  if (fs.existsSync(piperExe) && !force) {
    console.log(`[Piper] Binario ya existe: ${piperExe}`);
  } else {
    const zipPath = path.join(TARGET_DIR, 'piper-bin.download.zip');
    console.log(`[Piper] Descargando binario (~21 MB): ${PIPER_BIN_URL}`);
    await downloadFile(PIPER_BIN_URL, zipPath, 0);
    console.log('[Piper] Extrayendo binario...');
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${TARGET_DIR}" -Force`], { stdio: 'inherit' });
    fs.rmSync(zipPath, { force: true });
    if (!fs.existsSync(piperExe)) throw new Error(`La extraccion no produjo ${piperExe}`);
    console.log('[Piper] Binario instalado.');
  }

  // 2. Voz (.onnx + .onnx.json)
  const onnxPath = path.join(TARGET_DIR, `${voiceId}.onnx`);
  const voiceComplete = fileHasContent(onnxPath) && fileHasContent(`${onnxPath}.json`);
  if (voiceComplete && !force) {
    console.log(`[Piper] Voz '${voiceId}' ya instalada: ${onnxPath}`);
  } else {
    console.log(`[Piper] Descargando voz '${voiceId}' (~60-75 MB)...`);
    await downloadFile(`${HF_BASE}/${voicePath}.onnx?download=true`, onnxPath, 0);
    await downloadFile(`${HF_BASE}/${voicePath}.onnx.json?download=true`, `${onnxPath}.json`, 0);
    console.log('[Piper] Voz instalada.');
  }

  console.log(`[Piper] Listo. Binario: ${piperExe} | Voz: ${onnxPath}`);
}

function fileHasContent(filePath) {
  try { return fs.statSync(filePath).size > 0; } catch { return false; }
}

function downloadFile(url, dest, redirects) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error(`Demasiadas redirecciones para ${url}`));
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.rmSync(dest, { force: true });
        // La redireccion puede ser relativa (HuggingFace): resolver contra la URL origen.
        const nextUrl = new URL(res.headers.location, url).toString();
        return resolve(downloadFile(nextUrl, dest, redirects + 1));
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
  console.error(`[Piper] Error: ${err.message}`);
  process.exit(1);
});
