import { GoogleGenAI } from '@google/genai';
import { BROWSER_SEMANTIC_LIMITS as LIMIT, validateBrowserSemanticRequest, type BrowserSemanticRequest, type BrowserSemanticResponse, type BrowserSemanticSource } from '../../src/shared/browser-semantic-memory';
import { BrowserSemanticMemoryStore, EMPTY_SEMANTIC_SNAPSHOT, normalizeSemanticVector, semanticSource } from './semantic-memory-store';

export type SemanticEmbedder = (texts: string[], query: boolean, signal: AbortSignal) => Promise<number[][]>;
export function googleSemanticEmbedder(key: () => string | null): SemanticEmbedder {
  return async (texts, query, signal) => {
    const apiKey = key();
    if (!apiKey) throw new Error('Configura Gemini antes de reconstruir o buscar.');
    const result = await new GoogleGenAI({ apiKey }).models.embedContent({ model: 'gemini-embedding-001', contents: texts,
      config: { outputDimensionality: LIMIT.dimensions, taskType: query ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT', abortSignal: signal, httpOptions: { timeout: 30_000 } } });
    if (!result.embeddings || result.embeddings.length !== texts.length) throw new Error('Respuesta de memoria incompleta.');
    return result.embeddings.map(item => normalizeSemanticVector(item.values));
  };
}
export interface SemanticContext {
  guard: () => void;
  sources: () => Promise<BrowserSemanticSource[]>;
  confirm: (action: 'enable' | 'disable') => Promise<boolean>;
}
const identity = (entry: BrowserSemanticSource) => JSON.stringify([entry.source, entry.id, entry.title, entry.url]);
function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Memoria cancelada.'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Exclusión de operaciones, cancelación y revalidación de fuentes antes de publicar. */
export class BrowserSemanticMemory {
  private active: { location: string; controller: AbortController } | null = null;
  private revision = 0;
  constructor(private readonly store = new BrowserSemanticMemoryStore(), private embed: SemanticEmbedder = googleSemanticEmbedder(() => null)) {}
  configureKey(provider: () => string | null): void { this.embed = googleSemanticEmbedder(provider); }
  cancel(): void { this.active?.controller.abort(); }
  prepareRecovery(guard: () => void) {
    if (this.active) throw new Error('Cancela la operación de memoria antes de recuperarla.');
    const location = this.store.path(); const revision = this.revision;
    const current = () => { guard(); if (this.active || this.revision !== revision || this.store.path() !== location) throw new Error('El contexto de memoria cambió.'); };
    return this.store.prepareRecovery(current);
  }
  private async current(context: SemanticContext): Promise<BrowserSemanticSource[]> {
    context.guard();
    const entries = await context.sources(); context.guard();
    const seen = new Set<string>(); const counts = { history: 0, bookmark: 0 };
    return entries.map(semanticSource).filter((entry): entry is BrowserSemanticSource => {
      if (!entry || seen.has(`${entry.source}:${entry.id}`) || counts[entry.source] >= LIMIT.perSource) return false;
      seen.add(`${entry.source}:${entry.id}`); counts[entry.source]++; return true;
    });
  }
  async run(raw: BrowserSemanticRequest, context: SemanticContext): Promise<BrowserSemanticResponse> {
    const input = validateBrowserSemanticRequest(raw); context.guard();
    const location = this.store.path();
    if (input.action === 'cancel') { if (this.active?.location === location) this.cancel(); return { success: true, canceled: true }; }
    if (input.action !== 'status' && this.active) throw new Error('Hay una operación de memoria pendiente.');
    let snapshot = this.store.read(location);
    const status = () => ({ enabled: snapshot.enabled, count: snapshot.entries.length, indexedAt: snapshot.indexedAt, busy: this.active?.location === location });
    if (snapshot.indexedAt !== null && Date.now() - snapshot.indexedAt >= LIMIT.days * 86_400_000) {
      snapshot = { ...snapshot, entries: [], indexedAt: null }; this.store.write(location, snapshot, context.guard);
    }
    if (input.action === 'status') return { success: true, status: status() };
    const controller = new AbortController(); this.active = { location, controller }; this.revision++;
    const deadline = Date.now() + 120_000;
    const expires = setTimeout(() => controller.abort(), 120_000);
    const guard = () => { context.guard(); if (controller.signal.aborted || Date.now() >= deadline) throw new Error('Operación cancelada o vencida.'); };
    try {
      if (input.action === 'enable' || input.action === 'disable') {
        if (input.action === 'enable' && snapshot.enabled) return { success: true, status: { ...status(), busy: false } };
        const accepted = await context.confirm(input.action); guard();
        if (!accepted) return { success: true, canceled: true };
        snapshot = { ...EMPTY_SEMANTIC_SNAPSHOT(), enabled: input.action === 'enable' };
        this.store.write(location, snapshot, guard);
        return { success: true, status: { ...status(), busy: false } };
      }
      if (!snapshot.enabled) throw new Error('Activa la memoria con consentimiento antes de usarla.');
      const sources = await this.current({ ...context, guard }); guard();
      if (input.action === 'rebuild') {
        const entries = [];
        for (let start = 0; start < sources.length; start += 32) {
          guard(); const batch = sources.slice(start, start + 32);
          const vectors = await cancellable(this.embed(batch.map(entry => `${entry.title}\n${entry.url}`), false, controller.signal), controller.signal); guard();
          if (vectors.length !== batch.length) throw new Error('Lote incompleto.');
          entries.push(...batch.map((entry, index) => ({ ...entry, vector: normalizeSemanticVector(vectors[index]) })));
        }
        const fresh = new Set((await this.current({ ...context, guard })).map(identity)); guard();
        snapshot = { enabled: true, indexedAt: Date.now(), entries: entries.filter(entry => fresh.has(identity(entry))) };
        this.store.write(location, snapshot, guard);
        return { success: true, status: { ...status(), busy: false } };
      }
      const allowed = new Set(sources.map(identity));
      snapshot = { ...snapshot, entries: snapshot.entries.filter(entry => allowed.has(identity(entry))) };
      this.store.write(location, snapshot, guard);
      if (!snapshot.entries.length) return { success: true, status: { ...status(), busy: false }, results: [] };
      if (input.action !== 'search') throw new Error('Acción de memoria inválida.');
      const query = normalizeSemanticVector((await cancellable(this.embed([input.query], true, controller.signal), controller.signal))[0]); guard();
      const fresh = new Set((await this.current({ ...context, guard })).map(identity)); guard();
      snapshot.entries = snapshot.entries.filter(entry => fresh.has(identity(entry)));
      this.store.write(location, snapshot, guard);
      const results = snapshot.entries.map(({ vector, ...entry }) => ({ ...entry, score: vector.reduce((sum, n, i) => sum + n * query[i], 0) }))
        .filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, LIMIT.results);
      return { success: true, status: { ...status(), busy: false }, results };
    } finally { clearTimeout(expires); if (this.active?.controller === controller) this.active = null; }
  }
}
