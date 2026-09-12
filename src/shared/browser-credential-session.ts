export type BrowserCredentialSessionRequest = { action: 'status' | 'unlock' | 'lock'; profileRevision: number };
export type BrowserCredentialSessionResponse = { success: boolean; unlocked?: boolean; error?: string };
export function validateCredentialSessionRequest(raw: unknown): BrowserCredentialSessionRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== 2
    || !('action' in raw) || typeof raw.action !== 'string' || !['status', 'unlock', 'lock'].includes(raw.action)
    || !('profileRevision' in raw) || !Number.isSafeInteger(raw.profileRevision) || (raw.profileRevision as number) < 0) {
    throw new Error('Solicitud de bóveda inválida.');
  }
  return raw as BrowserCredentialSessionRequest;
}
