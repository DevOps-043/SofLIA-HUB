// =============================================================================
// SofLIA Hub - Voz de la orbe (Google Cloud Text-to-Speech) — Main Process
// =============================================================================
// La sintesis vive en main y NO en el renderer por dos motivos:
//   1. Fiabilidad: main tiene TODAS las variables del .env (dotenv). El renderer
//      solo ve las que Vite expone, y la key de TTS se quedaba fuera: caia a otra
//      key cuyo proyecto no tiene habilitada la API (403) y la voz no sonaba.
//   2. Seguridad: la API key nunca viaja al renderer.
// =============================================================================
import https from 'node:https';

const TTS_HOST = 'texttospeech.googleapis.com';
const TTS_PATH = '/v1/text:synthesize';
const DEFAULT_VOICE = 'es-US-Chirp3-HD-Aoede';
const DEFAULT_LANGUAGE = 'es-US';

export interface OrbSpeechAudio {
  /** WAV (LINEAR16) en base64, tal cual lo devuelve Google. */
  audioBase64: string;
  voice: string;
}

// Solo variables con prefijo VITE_: son las unicas que el build incrusta en el
// proceso main (vite.config -> loadEnv("VITE_") -> define). Sin ese prefijo la
// variable queda undefined en la app instalada (no se empaqueta ningun .env).
function getTtsConfig(): { apiKey: string; voice: string; languageCode: string } {
  const apiKey = process.env.VITE_GOOGLE_CLOUD_TTS_API_KEY
    || process.env.VITE_GEMINI_API_KEY
    || '';
  const voice = process.env.VITE_GOOGLE_CLOUD_TTS_VOICE
    || DEFAULT_VOICE;
  const languageCode = process.env.VITE_GOOGLE_CLOUD_TTS_LANGUAGE
    || voice.split('-').slice(0, 2).join('-')
    || DEFAULT_LANGUAGE;
  return { apiKey, voice, languageCode };
}

let configLogged = false;

/** Sintetiza texto con Google Cloud TTS. Devuelve el WAV en base64. */
export async function synthesizeOrbSpeech(text: string): Promise<OrbSpeechAudio> {
  const { apiKey, voice, languageCode } = getTtsConfig();
  if (!apiKey) {
    throw new Error('Falta VITE_GOOGLE_CLOUD_TTS_API_KEY en el .env para la voz de SofLIA.');
  }
  if (!configLogged) {
    configLogged = true;
    console.log(`[OrbTTS] Voz de Google Cloud: ${voice} (${languageCode})`);
  }

  const payload = JSON.stringify({
    input: { text },
    voice: { languageCode, name: voice },
    // Sin sampleRateHertz: Google entrega la tasa nativa de la voz (mejor calidad).
    audioConfig: { audioEncoding: 'LINEAR16' },
  });

  const body = await postJson(`${TTS_PATH}?key=${apiKey}`, payload);
  const parsed = JSON.parse(body) as { audioContent?: string; error?: { message?: string } };
  if (parsed.error?.message) throw new Error(parsed.error.message);
  if (!parsed.audioContent) throw new Error('Google Cloud TTS no devolvio audio.');
  return { audioBase64: parsed.audioContent, voice };
}

// Conexion reutilizable: sin keep-alive cada bloque de voz pagaba un handshake
// TLS completo, sumando latencia entre frases durante una misma respuesta.
const ttsAgent = new https.Agent({ keepAlive: true, maxSockets: 4 });

function postJson(path: string, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.request({
      host: TTS_HOST,
      path,
      method: 'POST',
      agent: ttsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 30_000,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    request.on('timeout', () => request.destroy(new Error('Timeout al sintetizar la voz.')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}
