import type { WebContents } from 'electron';
import {
  elevenLabsProviderError,
  requestElevenLabsSpeech,
} from '../elevenlabs-tts';
import {
  clearBrowserReadingToolbar,
  clearBrowserReadingHighlight,
  collectBrowserReadingContent,
  isGoogleDocsDocument,
  installBrowserReadingHighlight,
  installBrowserReadingToolbar,
  updateBrowserReadingHighlight,
  updateBrowserReadingToolbar,
  updateBrowserReadingToolbarCue,
  waitForBrowserReadingToolbarAction,
  type BrowserReadingContent,
  type BrowserReadingPrepareInput,
  type BrowserReadingToolbarAction,
  type BrowserReadingToolbarState,
} from './reading-mode-content';
import {
  mapPreparedSpeechRange,
  prepareSpeechText,
  type PreparedSpeechText,
} from '../speech-text-normalizer';

export const READING_SPEECH_MAX_CHARS = 3_500;
export const READING_SPEECH_TIMEOUT_MS = 20_000;
export const READING_SESSION_TTL_MS = 30 * 60_000;
export const READING_AUDIO_MAX_BYTES = 64 * 1024 * 1024;

export interface BrowserReadingWordTiming {
  start: number;
  end: number;
  startTime: number;
  endTime: number;
}

export interface BrowserReadingSpeechResult {
  readingId: string;
  start: number;
  end: number;
  audioBase64: string;
  mimeType: 'audio/mpeg';
  durationSeconds: number;
  timings: BrowserReadingWordTiming[];
}

interface ReadingSession {
  content: BrowserReadingContent;
  contents: WebContents;
  expiresAt: number;
  highlightRevision: number;
  highlightReady: Promise<boolean>;
  domHighlightEnabled: boolean;
}

interface ElevenLabsAlignment {
  characters?: unknown;
  character_start_times_seconds?: unknown;
  character_end_times_seconds?: unknown;
}

interface ElevenLabsResponse {
  audio_base64?: unknown;
  alignment?: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
  detail?: unknown;
}

export class BrowserReadingModeService {
  private readonly sessions = new Map<string, ReadingSession>();
  private readonly activeRequests = new Map<string, { readingId: string; controller: AbortController }>();

  async prepare(input: {
    contents: WebContents;
    tabId: string;
    request: BrowserReadingPrepareInput;
  }): Promise<BrowserReadingContent> {
    this.prune();
    const content = await collectBrowserReadingContent(input);
    // La cápsula es pequeña y se instala primero. El mapa DOM de resaltado se
    // construye en segundo plano para no aumentar la latencia de apertura.
    const toolbarInstalled = await installBrowserReadingToolbar(input.contents, {
      readingId: content.readingId,
      text: content.text,
      selectionOnly: content.selectionOnly,
    }).catch(() => false);
    if (!toolbarInstalled) {
      throw new Error('No fue posible mostrar los controles de lectura en esta página.');
    }
    // Google Docs pinta el documento en un lienzo virtual sin rangos DOM
    // estables. Mapear el texto exportado contra la interfaz marcaria menus
    // laterales con palabras coincidentes, por lo que se degrada solo el
    // subrayado y se conserva la narracion.
    const domHighlightEnabled = !isGoogleDocsDocument(content.url);
    const highlightReady = domHighlightEnabled
      ? installBrowserReadingHighlight(input.contents, {
        readingId: content.readingId,
        text: content.text,
      }).catch(() => false)
      : Promise.resolve(false);
    this.sessions.set(content.readingId, {
      content,
      contents: input.contents,
      expiresAt: Date.now() + READING_SESSION_TTL_MS,
      highlightRevision: 0,
      highlightReady,
      domHighlightEnabled,
    });
    return content;
  }

  async highlight(raw: { readingId: string; start?: number; end?: number }): Promise<{ highlighted: boolean }> {
    this.prune();
    const readingId = requireId(raw?.readingId, 'lectura');
    const hasStart = raw?.start !== undefined;
    const hasEnd = raw?.end !== undefined;
    if (hasStart !== hasEnd) throw new Error('El rango de resaltado no es válido.');
    const session = this.requireSession(readingId);
    if (hasStart && (!Number.isSafeInteger(raw.start) || !Number.isSafeInteger(raw.end)
      || raw.start! < 0 || raw.end! <= raw.start! || raw.end! > session.content.text.length)) {
      throw new Error('El rango de resaltado no es válido.');
    }
    if (session.contents.isDestroyed() || !sameReadingUrl(session.content.url, session.contents.getURL())) {
      throw new Error('La página de lectura ya no está activa.');
    }
    if (!session.domHighlightEnabled) {
      const cueVisible = await updateBrowserReadingToolbarCue(session.contents, {
        readingId,
        text: hasStart ? session.content.text.slice(raw.start!, raw.end!) : undefined,
      }).catch(() => false);
      return { highlighted: cueVisible };
    }
    await session.highlightReady.catch(() => false);
    const highlighted = await updateBrowserReadingHighlight(session.contents, {
      readingId,
      revision: ++session.highlightRevision,
      start: raw.start,
      end: raw.end,
    }).catch(() => false);
    return { highlighted };
  }

  async waitForToolbarAction(raw: { readingId: string }): Promise<BrowserReadingToolbarAction> {
    this.prune();
    const readingId = requireId(raw?.readingId, 'lectura');
    const session = this.requireSession(readingId);
    if (session.contents.isDestroyed() || !sameReadingUrl(session.content.url, session.contents.getURL())) {
      return { readingId, action: 'closed' };
    }
    const action = await waitForBrowserReadingToolbarAction(session.contents, readingId).catch(() => ({ readingId, action: 'closed' as const }));
    return isToolbarAction(action) ? action : { readingId, action: 'closed' };
  }

  async syncToolbar(raw: BrowserReadingToolbarState): Promise<{ toolbarVisible: boolean }> {
    this.prune();
    const state = validateToolbarState(raw);
    const session = this.requireSession(state.readingId);
    if (session.contents.isDestroyed() || !sameReadingUrl(session.content.url, session.contents.getURL())) {
      return { toolbarVisible: false };
    }
    const toolbarVisible = await updateBrowserReadingToolbar(session.contents, state).catch(() => false);
    return { toolbarVisible };
  }

  async close(raw: { readingId: string }): Promise<{ closed: boolean }> {
    const readingId = requireId(raw?.readingId, 'lectura');
    const session = this.sessions.get(readingId);
    this.cancel({ readingId });
    if (!session) return { closed: false };
    await Promise.all([
      clearBrowserReadingHighlight(session.contents, readingId).catch(() => undefined),
      clearBrowserReadingToolbar(session.contents, readingId).catch(() => undefined),
    ]);
    this.sessions.delete(readingId);
    return { closed: true };
  }

  async synthesize(raw: { readingId: string; requestId: string; start: number; end: number }): Promise<BrowserReadingSpeechResult> {
    this.prune();
    const input = validateSynthesisInput(raw);
    const session = this.requireSession(input.readingId);
    if (input.end > session.content.text.length) throw new Error('El segmento de lectura queda fuera del contenido preparado.');
    const sourceSlice = session.content.text.slice(input.start, input.end);
    const leadingWhitespace = sourceSlice.length - sourceSlice.trimStart().length;
    const text = sourceSlice.trim();
    if (!text) throw new Error('El segmento de lectura está vacío.');
    if (text.length > READING_SPEECH_MAX_CHARS) throw new Error(`Cada segmento admite hasta ${READING_SPEECH_MAX_CHARS} caracteres.`);
    if (this.activeRequests.has(input.requestId)) throw new Error('Ya existe una síntesis activa con ese identificador.');

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error('ElevenLabs tardó demasiado en generar este lote. Intenta reproducirlo de nuevo.'));
    }, READING_SPEECH_TIMEOUT_MS);
    this.activeRequests.set(input.requestId, { readingId: input.readingId, controller });
    try {
      const prepared = prepareSpeechText(text, session.content.language);
      const previous = prepareSpeechText(
        session.content.text.slice(Math.max(0, input.start - 600), input.start),
        session.content.language,
      ).text;
      const next = prepareSpeechText(
        session.content.text.slice(input.end, Math.min(session.content.text.length, input.end + 600)),
        session.content.language,
      ).text;
      const { response } = await requestElevenLabsSpeech({
        text: prepared.text,
        withTimestamps: true,
        signal: controller.signal,
        languageCode: session.content.language,
        previousText: previous,
        nextText: next,
      });
      const payload = await readProviderPayload(response);
      if (!response.ok) throw new Error(elevenLabsProviderError(response.status, payload.detail));
      const parsed = parseSpeechResponse(payload, prepared, input.start + leadingWhitespace);
      const buffer = Buffer.from(parsed.audioBase64, 'base64');
      if (!buffer.length || buffer.length > READING_AUDIO_MAX_BYTES) throw new Error('ElevenLabs devolvió un audio fuera de rango.');
      return {
        readingId: input.readingId,
        start: input.start,
        end: input.end,
        audioBase64: parsed.audioBase64,
        mimeType: 'audio/mpeg',
        durationSeconds: parsed.durationSeconds,
        timings: parsed.timings,
      };
    } catch (error) {
      if (timedOut) {
        // El target TS vigente no expone `ErrorOptions`; el mensaje se sanea
        // deliberadamente para no filtrar la respuesta del proveedor.
        // eslint-disable-next-line preserve-caught-error
        throw new Error('ElevenLabs tardó demasiado en generar este lote. Intenta reproducirlo de nuevo.');
      }
      if (controller.signal.aborted) {
        // eslint-disable-next-line preserve-caught-error
        throw new Error('La generación de audio fue cancelada.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      this.activeRequests.delete(input.requestId);
    }
  }

  cancel(raw: { readingId: string; requestId?: string }): { canceled: number } {
    const readingId = requireId(raw?.readingId, 'lectura');
    const requestId = raw?.requestId === undefined ? undefined : requireId(raw.requestId, 'solicitud');
    let canceled = 0;
    for (const [id, active] of this.activeRequests) {
      if (active.readingId !== readingId || (requestId && id !== requestId)) continue;
      active.controller.abort();
      this.activeRequests.delete(id);
      canceled += 1;
    }
    return { canceled };
  }

  dispose(): void {
    for (const active of this.activeRequests.values()) active.controller.abort();
    this.activeRequests.clear();
    for (const [readingId, session] of this.sessions) {
      void clearBrowserReadingHighlight(session.contents, readingId).catch(() => undefined);
      void clearBrowserReadingToolbar(session.contents, readingId).catch(() => undefined);
    }
    this.sessions.clear();
  }

  private requireSession(readingId: string): ReadingSession {
    const id = requireId(readingId, 'lectura');
    const session = this.sessions.get(id);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(id);
      throw new Error('La sesión de lectura expiró. Vuelve a abrir el modo lectura.');
    }
    session.expiresAt = Date.now() + READING_SESSION_TTL_MS;
    return session;
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt > now) continue;
      this.sessions.delete(id);
      void clearBrowserReadingHighlight(session.contents, id).catch(() => undefined);
      void clearBrowserReadingToolbar(session.contents, id).catch(() => undefined);
    }
  }
}

function sameReadingUrl(expected: string, current: string): boolean {
  try {
    const left = new URL(expected);
    const right = new URL(current);
    left.hash = '';
    right.hash = '';
    return left.toString() === right.toString();
  } catch {
    return false;
  }
}

function validateSynthesisInput(raw: { readingId: string; requestId: string; start: number; end: number }): typeof raw {
  const readingId = requireId(raw?.readingId, 'lectura');
  const requestId = requireId(raw?.requestId, 'solicitud');
  if (!Number.isSafeInteger(raw?.start) || !Number.isSafeInteger(raw?.end) || raw.start < 0 || raw.end <= raw.start) {
    throw new Error('El rango de narración no es válido.');
  }
  return { readingId, requestId, start: raw.start, end: raw.end };
}

const TOOLBAR_ACTIONS = new Set(['toggle', 'stop', 'speed-down', 'speed-up', 'close', 'closed']);
const TOOLBAR_STATUSES = new Set(['idle', 'loading', 'playing', 'paused', 'completed', 'error']);

function isToolbarAction(value: unknown): value is BrowserReadingToolbarAction {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { readingId?: unknown; action?: unknown };
  return typeof candidate.readingId === 'string'
    && typeof candidate.action === 'string'
    && TOOLBAR_ACTIONS.has(candidate.action);
}

function validateToolbarState(raw: BrowserReadingToolbarState): BrowserReadingToolbarState {
  const readingId = requireId(raw?.readingId, 'lectura');
  if (!TOOLBAR_STATUSES.has(raw?.status)
    || typeof raw?.speed !== 'number' || !Number.isFinite(raw.speed) || raw.speed < 0.5 || raw.speed > 3
    || (raw?.message !== undefined && (typeof raw.message !== 'string' || raw.message.length > 240))) {
    throw new Error('El estado del reproductor no es válido.');
  }
  return {
    readingId,
    status: raw.status,
    speed: Math.round(raw.speed * 100) / 100,
    message: raw.message,
  };
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(value)) throw new Error(`El identificador de ${label} no es válido.`);
  return value;
}

async function readProviderPayload(response: Response): Promise<ElevenLabsResponse> {
  const text = await response.text();
  if (text.length > 30 * 1024 * 1024) throw new Error('ElevenLabs devolvió una respuesta demasiado grande.');
  try {
    return JSON.parse(text) as ElevenLabsResponse;
  } catch {
    throw new Error('ElevenLabs devolvió una respuesta no válida.');
  }
}

function parseSpeechResponse(payload: ElevenLabsResponse, prepared: PreparedSpeechText, globalStart: number): {
  audioBase64: string;
  durationSeconds: number;
  timings: BrowserReadingWordTiming[];
} {
  if (typeof payload.audio_base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(payload.audio_base64)) {
    throw new Error('ElevenLabs no devolvió audio válido.');
  }
  const alignment = validAlignment(payload.alignment) ?? validAlignment(payload.normalized_alignment);
  if (!alignment) throw new Error('ElevenLabs no devolvió marcas temporales válidas.');
  const timings = buildWordTimings(alignment.characters, alignment.starts, alignment.ends, prepared, globalStart);
  if (!timings.length) throw new Error('No se pudieron alinear el texto y la narración.');
  return {
    audioBase64: payload.audio_base64,
    durationSeconds: alignment.ends[alignment.ends.length - 1] ?? 0,
    timings,
  };
}

function validAlignment(value: ElevenLabsAlignment | undefined): { characters: string[]; starts: number[]; ends: number[] } | null {
  if (!value || !Array.isArray(value.characters) || !Array.isArray(value.character_start_times_seconds) || !Array.isArray(value.character_end_times_seconds)) return null;
  if (value.characters.length === 0 || value.characters.length !== value.character_start_times_seconds.length || value.characters.length !== value.character_end_times_seconds.length) return null;
  if (value.character_start_times_seconds.some((item) => typeof item !== 'number')
    || value.character_end_times_seconds.some((item) => typeof item !== 'number')) return null;
  const characters = value.characters.map((item) => typeof item === 'string' ? item : '');
  const starts = value.character_start_times_seconds as number[];
  const ends = value.character_end_times_seconds as number[];
  if (characters.some((item) => !item)
    || starts.some((item, index) => !Number.isFinite(item) || item < 0 || (index > 0 && item < starts[index - 1]))
    || ends.some((item, index) => !Number.isFinite(item) || item < starts[index] || (index > 0 && item < ends[index - 1]))) return null;
  return { characters, starts, ends };
}

function buildWordTimings(characters: string[], starts: number[], ends: number[], prepared: PreparedSpeechText, globalStart: number): BrowserReadingWordTiming[] {
  const spoken = characters.join('');
  const timings: BrowserReadingWordTiming[] = [];
  const wordPattern = /\S+/gu;
  let match: RegExpExecArray | null;
  let searchFrom = 0;
  while ((match = wordPattern.exec(spoken))) {
    const word = match[0];
    const sourceIndex = prepared.text.indexOf(word, searchFrom);
    if (sourceIndex < 0) continue;
    searchFrom = sourceIndex + word.length;
    const sourceRange = mapPreparedSpeechRange(prepared, sourceIndex, sourceIndex + word.length);
    if (!sourceRange) continue;
    const startCharacter = characterArrayIndexAtOffset(characters, match.index);
    const endCharacter = characterArrayIndexAtOffset(characters, match.index + word.length - 1);
    timings.push({
      start: globalStart + sourceRange.start,
      end: globalStart + sourceRange.end,
      startTime: starts[startCharacter] ?? 0,
      endTime: ends[endCharacter] ?? starts[startCharacter] ?? 0,
    });
  }
  return timings;
}

function characterArrayIndexAtOffset(characters: string[], offset: number): number {
  let consumed = 0;
  for (let index = 0; index < characters.length; index += 1) {
    consumed += characters[index].length;
    if (consumed > offset) return index;
  }
  return Math.max(0, characters.length - 1);
}

