export function normalizePhoneToJid(rawPhone: string): string {
  const clean = String(rawPhone || '').replace(/[\s\-+()]/g, '');
  return `${clean}@s.whatsapp.net`;
}
