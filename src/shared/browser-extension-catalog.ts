export type BrowserExtensionCatalogRequest = { action: 'list' } | { action: 'prepare'; catalogId: string; updateInstallId?: string };
export interface BrowserExtensionCatalogEntry {
  id: string; name: string; publisher: string; version: string; revision: string;
  sourceUrl: string; description: string;
}
export function validateExtensionCatalogRequest(raw: unknown): BrowserExtensionCatalogRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Solicitud de catálogo inválida.');
  const value = raw as Record<string, unknown>; const keys = Object.keys(value).sort().join(',');
  if (value.action === 'list' && keys === 'action') return { action: 'list' };
  if (value.action === 'prepare' && ['action,catalogId', 'action,catalogId,updateInstallId'].includes(keys)
    && typeof value.catalogId === 'string' && /^[a-z0-9-]{1,80}$/.test(value.catalogId)
    && (value.updateInstallId === undefined || typeof value.updateInstallId === 'string' && /^[a-f\d-]{16,64}$/i.test(value.updateInstallId))) {
    return { action: 'prepare', catalogId: value.catalogId, ...(value.updateInstallId ? { updateInstallId: value.updateInstallId as string } : {}) };
  }
  throw new Error('Solicitud de catálogo inválida.');
}
