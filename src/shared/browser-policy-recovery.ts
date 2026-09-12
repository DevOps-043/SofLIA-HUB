export const POLICY_RECOVERY_LABELS = { permissions: 'permisos por sitio', privacy: 'privacidad', agent: 'políticas del agente', shortcuts: 'atajos', semantic: 'memoria semántica', history: 'historial', audit: 'bitácora' } as const;
export type BrowserPolicyRecoveryRequest = { store: keyof typeof POLICY_RECOVERY_LABELS; profileRevision: number };
export type BrowserPolicyRecoveryResponse = { success: boolean; cancelled?: boolean; restored?: number; error?: string };
export function validatePolicyRecoveryRequest(raw: unknown): BrowserPolicyRecoveryRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Solicitud de recuperación inválida.');
  const value = raw as BrowserPolicyRecoveryRequest;
  if (Object.keys(value).sort().join(',') !== 'profileRevision,store' || typeof value.store !== 'string' || !Object.prototype.hasOwnProperty.call(POLICY_RECOVERY_LABELS, value.store)
    || !Number.isSafeInteger(value.profileRevision) || value.profileRevision < 0) throw new Error('Solicitud de recuperación inválida.');
  return { store: value.store, profileRevision: value.profileRevision };
}
