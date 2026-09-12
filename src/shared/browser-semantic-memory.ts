export const BROWSER_SEMANTIC_LIMITS = { perSource: 200, count: 400, query: 500, title: 200, url: 1024, dimensions: 768, days: 30, results: 10 } as const;
export type BrowserSemanticRequest = ({ action: 'status' | 'enable' | 'disable' | 'rebuild' | 'cancel' } | { action: 'search'; query: string }) & { profileRevision: number };
export interface BrowserSemanticSource { id: string; source: 'history' | 'bookmark'; title: string; url: string }
export interface BrowserSemanticStatus { enabled: boolean; count: number; indexedAt: number | null; busy: boolean }
export interface BrowserSemanticResponse { success: boolean; error?: string; canceled?: boolean; status?: BrowserSemanticStatus; results?: (BrowserSemanticSource & { score: number })[] }

export function validateBrowserSemanticRequest(raw: unknown): BrowserSemanticRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Solicitud de memoria inválida.');
  const input = raw as BrowserSemanticRequest;
  if (!Number.isSafeInteger(input.profileRevision) || input.profileRevision < 0) throw new Error('Perfil inválido.');
  const keys = Object.keys(input).sort().join(',');
  if (input.action === 'search' && keys === 'action,profileRevision,query' && typeof input.query === 'string' && input.query.trim() && input.query.length <= BROWSER_SEMANTIC_LIMITS.query) return { ...input, query: input.query.trim() };
  if (['status', 'enable', 'disable', 'rebuild', 'cancel'].includes(input.action) && keys === 'action,profileRevision') return { ...input };
  throw new Error('Solicitud de memoria inválida.');
}
