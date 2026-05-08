export function formatFtsQuery(query: string): string {
  return query
    .replace(/["'()*^{}\[\]~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
