export function buildShareToken(prefix: 'conv' | 'fold'): string {
  const token = crypto.randomUUID().replace(/-/g, '');
  return `${prefix}_${token}`;
}
