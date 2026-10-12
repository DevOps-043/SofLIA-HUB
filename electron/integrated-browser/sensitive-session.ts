/** Las URLs de inicio pueden portar ZAK; solo se exponen origen y título. */
export function sensitiveSessionDisplayUrl(url: string): string {
  try { return `${new URL(url).origin}/`; } catch { return 'about:blank'; }
}
