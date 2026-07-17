/**
 * Modelo de embeddings de voz para diarizacion de hablantes (Meeting Live).
 *
 * CAM++ de 3D-Speaker (192 dims, 16kHz, ~28MB, Apache-2.0), distribuido en los
 * releases de sherpa-onnx como ONNX. Se descarga una sola vez a
 * userData/models/speaker; si la descarga falla la reunion se transcribe igual,
 * solo que sin separar voces (degradacion explicita, nunca bloqueo).
 */
import { app, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const SPEAKER_MODEL_FILENAME = '3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx';
// El tag del release de sherpa-onnx contiene el typo "recongition" (es asi upstream).
const SPEAKER_MODEL_URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/${SPEAKER_MODEL_FILENAME}`;
/** Un ONNX truncado por red rompe la sesion: se valida tamaño minimo plausible. */
const SPEAKER_MODEL_MIN_BYTES = 5_000_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

let inFlightDownload: Promise<string | null> | null = null;

export function getSpeakerModelPath(): string {
  return path.join(app.getPath('userData'), 'models', 'speaker', SPEAKER_MODEL_FILENAME);
}

export function isSpeakerModelInstalled(): boolean {
  try {
    const stats = fs.statSync(getSpeakerModelPath());
    return stats.size >= SPEAKER_MODEL_MIN_BYTES;
  } catch {
    return false;
  }
}

/**
 * Devuelve la ruta del modelo, descargandolo si falta. null si no se pudo
 * obtener (sin red, disco lleno): la diarizacion se omite en esa sesion.
 */
export async function ensureSpeakerModel(): Promise<string | null> {
  if (isSpeakerModelInstalled()) return getSpeakerModelPath();
  if (!inFlightDownload) {
    inFlightDownload = downloadSpeakerModel().finally(() => { inFlightDownload = null; });
  }
  return inFlightDownload;
}

async function downloadSpeakerModel(): Promise<string | null> {
  const targetPath = getSpeakerModelPath();
  const partialPath = `${targetPath}.download`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  console.log('[MeetingLive] Descargando modelo de hablantes (CAM++, ~28MB)...');
  try {
    await downloadWithNet(SPEAKER_MODEL_URL, partialPath);
    const stats = fs.statSync(partialPath);
    if (stats.size < SPEAKER_MODEL_MIN_BYTES) {
      throw new Error(`Descarga incompleta (${stats.size} bytes).`);
    }
    fs.renameSync(partialPath, targetPath);
    console.log('[MeetingLive] Modelo de hablantes instalado.');
    return targetPath;
  } catch (err) {
    fs.rmSync(partialPath, { force: true });
    console.warn('[MeetingLive] No se pudo descargar el modelo de hablantes (la reunion se transcribe sin diarizacion):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Descarga con electron.net (sigue redirects de GitHub → CDN automaticamente). */
function downloadWithNet(url: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    const file = fs.createWriteStream(destination);
    const timer = setTimeout(() => {
      request.abort();
      reject(new Error(`Timeout de descarga tras ${DOWNLOAD_TIMEOUT_MS / 1000}s.`));
    }, DOWNLOAD_TIMEOUT_MS);

    const fail = (err: Error) => {
      clearTimeout(timer);
      file.close(() => reject(err));
    };

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        fail(new Error(`HTTP ${response.statusCode} al descargar el modelo.`));
        return;
      }
      response.on('data', (chunk) => { file.write(chunk); });
      response.on('end', () => {
        clearTimeout(timer);
        file.end(() => resolve());
      });
      response.on('error', (err: Error) => fail(err));
    });
    request.on('error', fail);
    request.end();
  });
}
