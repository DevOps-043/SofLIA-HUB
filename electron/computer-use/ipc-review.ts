import { createHash } from 'node:crypto';

/** Describe el snapshot admitido. Contraseñas no aparecen en revisión ni digest. */
export function computerActionReview(tool: string, args: Record<string, unknown>): string {
  const review = { ...args };
  if (tool === 'configure_email') delete review.password;
  const digest = createHash('sha256').update(JSON.stringify(review)).digest('hex');
  const fields = Object.entries(review).map(([key, value]) => {
    if (value === undefined) return '';
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const limit = ['content', 'body', 'text', 'chart_images'].includes(key) ? 2000 : 20000;
    const shown = serialized.length > limit ? `${serialized.slice(0, limit)}\n[Vista previa; ${serialized.length} caracteres en total]` : serialized;
    return `${key}: ${shown}`;
  }).filter(Boolean);
  return `Operación: ${tool}\n${fields.join('\n')}\nSHA-256 de los argumentos revisados: ${digest}`;
}
