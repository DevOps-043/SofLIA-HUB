const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*+-=?';

/** Genera en el renderer una candidata que aún no pertenece a la bóveda. */
export function generateStrongPassword(length = 20): string {
  const size = Math.max(16, Math.min(64, Math.round(length)));
  const required = [LOWER, UPPER, DIGITS, SYMBOLS].map(pick);
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [...required, ...Array.from({ length: size - required.length }, () => pick(all))];
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join('');
}

function pick(alphabet: string): string { return alphabet[randomIndex(alphabet.length)]; }
function randomIndex(max: number): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % max;
}
