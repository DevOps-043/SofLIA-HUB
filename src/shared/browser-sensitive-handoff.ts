export const BROWSER_HANDOFF_MESSAGES = {
  secret: 'La página contiene campos o señales de secretos.',
  payment: 'La página contiene campos o señales de pago.',
  identity: 'La página contiene campos o señales de identidad personal.',
  medical: 'La página contiene señales de información médica.',
  autofill: 'Esta página recibió datos del gestor de contraseñas.',
  form: 'El formulario requiere revisión humana.',
  uninspectable: 'No se pudo inspeccionar con seguridad la estructura de la página.',
} as const;
export type BrowserSensitiveReason = keyof typeof BROWSER_HANDOFF_MESSAGES;
export interface BrowserSensitiveHandoff { reason: BrowserSensitiveReason }
export function validateBrowserSensitiveReason(raw: unknown): BrowserSensitiveReason | null {
  if (raw === null) return null;
  if (typeof raw === 'string' && Object.prototype.hasOwnProperty.call(BROWSER_HANDOFF_MESSAGES, raw)) return raw as BrowserSensitiveReason;
  return 'uninspectable';
}
