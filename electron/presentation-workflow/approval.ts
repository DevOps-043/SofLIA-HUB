const APPROVAL_WORDS = new Set(['si', 'ok', 'bien', 'adelante', 'perfecto', 'generar', 'hazlo']);

export function normalizeApprovalInput(text: string): string {
  return text.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isApprovalText(text: string): boolean {
  return APPROVAL_WORDS.has(normalizeApprovalInput(text));
}

export function isCancelApprovalText(text: string): boolean {
  const normalized = normalizeApprovalInput(text);
  return normalized.includes('no') || normalized.includes('cancela');
}
