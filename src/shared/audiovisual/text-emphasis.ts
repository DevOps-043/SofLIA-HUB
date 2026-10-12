/** Selección literal por palabras completas: evita destacar subcadenas ambiguas. */
export function emphasisWords(text: string, phrases: readonly string[]): Set<number> {
  const words = text.split(/\s+/), selected = new Set<number>();
  for (const phrase of phrases) {
    const parts = phrase.split(/\s+/);
    for (let start = 0; start <= words.length - parts.length; start++) {
      if (parts.every((word, offset) => words[start + offset] === word)) for (let offset = 0; offset < parts.length; offset++) selected.add(start + offset);
    }
  }
  return selected;
}
