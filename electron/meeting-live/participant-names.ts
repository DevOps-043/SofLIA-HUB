/**
 * Extraccion de nombres de participantes desde el OCR de la reunion.
 *
 * Meet/Teams/Zoom etiquetan cada tile con el nombre del participante: el OCR
 * de las capturas periodicas los ve. Aqui se filtran candidatos con heuristica
 * (lineas cortas con formato de nombre propio, sin vocabulario de UI) y se
 * acumulan con frecuencia: un nombre visto en varias capturas es casi seguro
 * un participante; el ruido del OCR aparece una vez y se descarta.
 *
 * Funciones puras + colector sin dependencias: testeables sin OCR real.
 */

/** Palabras de UI de reuniones que el OCR confunde con nombres. */
const UI_STOPWORDS = new Set([
  // Controles comunes (es/en)
  'silenciar', 'activar', 'micrófono', 'microfono', 'cámara', 'camara', 'compartir',
  'pantalla', 'chat', 'participantes', 'salir', 'abandonar', 'grabar', 'grabando',
  'reunión', 'reunion', 'llamada', 'presentando', 'presentación', 'presentacion',
  'mute', 'unmute', 'camera', 'share', 'screen', 'leave', 'record', 'recording',
  'meeting', 'call', 'presenting', 'presentation', 'more', 'options', 'view',
  'invitar', 'invite', 'detalles', 'details', 'vista', 'diseño', 'layout',
  // Plataformas y marcas
  'google', 'meet', 'zoom', 'teams', 'microsoft', 'webex', 'soflia',
  // Auto-referencias de los tiles
  'tú', 'tu', 'you', 'yo', 'usted', 'invitado', 'guest', 'anfitrión', 'anfitrion', 'host',
]);

const MAX_NAME_WORDS = 4;
const MIN_NAME_LENGTH = 5;
const MAX_NAME_LENGTH = 40;

/** Palabra con forma de nombre propio: inicial mayuscula + resto minusculas (acentos ok). */
const NAME_WORD_PATTERN = /^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü'.-]+$/;

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Candidatos a nombre de participante en un texto OCR. Deliberadamente
 * conservador: mejor perder un nombre raro que inventar participantes.
 */
export function extractCandidateNames(ocrText: string): string[] {
  const found = new Map<string, string>();
  for (const rawLine of ocrText.split(/\r?\n/)) {
    const line = rawLine.replace(/[|•·»«<>[\](){}]/g, ' ').replace(/\s+/g, ' ').trim();
    if (line.length < MIN_NAME_LENGTH || line.length > MAX_NAME_LENGTH) continue;
    if (/\d/.test(line)) continue; // los nombres de tile no traen digitos

    const words = line.split(' ');
    if (words.length < 2 || words.length > MAX_NAME_WORDS) continue;
    if (!words.every((word) => NAME_WORD_PATTERN.test(word))) continue;
    if (words.some((word) => UI_STOPWORDS.has(word.toLowerCase()))) continue;
    if (words.some((word) => UI_STOPWORDS.has(normalizeName(word)))) continue;

    const key = normalizeName(line);
    if (!found.has(key)) found.set(key, line);
  }
  return Array.from(found.values());
}

interface NameStats {
  display: string;
  count: number;
  lastSeenMs: number;
}

/**
 * Acumula candidatos a lo largo de la reunion. `getConfirmedNames()` devuelve
 * solo los vistos en 2+ capturas distintas (el ruido de OCR no se repite).
 */
export class ParticipantNameCollector {
  private readonly stats = new Map<string, NameStats>();

  addFromOcr(ocrText: string, capturedAtMs: number): string[] {
    const names = extractCandidateNames(ocrText);
    for (const name of names) {
      const key = normalizeName(name);
      const entry = this.stats.get(key);
      if (entry) {
        entry.count += 1;
        entry.lastSeenMs = capturedAtMs;
      } else {
        this.stats.set(key, { display: name, count: 1, lastSeenMs: capturedAtMs });
      }
    }
    return names;
  }

  getConfirmedNames(limit = 12): string[] {
    return Array.from(this.stats.values())
      .filter((entry) => entry.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((entry) => entry.display);
  }
}
