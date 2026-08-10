export interface PreparedSpeechText {
  text: string;
  /** Cada entrada traduce una frontera UTF-16 del texto hablado a la fuente. */
  sourceOffsets: number[];
  /** Rango de origen representado por cada unidad UTF-16 pronunciada. */
  sourceSpans: Array<{ start: number; end: number }>;
}

const SPEECH_TOKEN_PATTERN = /\bSofLIA\b|(?<![\d.])\bv\s*\d{1,9}\.\d{1,6}\b(?!\.\d)|(?<![\d.])\b\d{1,9}\.\d{1,6}\b(?!\.\d)/giu;
const DIGIT_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'] as const;

/**
 * Prepara casos ambiguos para una voz en español sin cambiar el contenido
 * visible. El mapa de fronteras permite devolver los timestamps a los offsets
 * originales aunque el alias hablado tenga otra longitud.
 */
export function prepareSpeechText(source: string, language = 'es'): PreparedSpeechText {
  if (!isSpanishLanguage(language)) return identitySpeechText(source);

  let text = '';
  const sourceOffsets = [0];
  const sourceSpans: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  SPEECH_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPEECH_TOKEN_PATTERN.exec(source))) {
    appendSourceSlice(source, cursor, match.index, (value, sourceStart, sourceEnd) => {
      text += value;
      sourceOffsets.push(sourceEnd);
      sourceSpans.push({ start: sourceStart, end: sourceEnd });
    });
    const spoken = speechAlias(match[0]);
    appendMappedReplacement(spoken, match.index, match.index + match[0].length, (value, sourceOffset, sourceSpan) => {
      text += value;
      sourceOffsets.push(sourceOffset);
      sourceSpans.push(sourceSpan);
    });
    cursor = match.index + match[0].length;
  }
  appendSourceSlice(source, cursor, source.length, (value, sourceStart, sourceEnd) => {
    text += value;
    sourceOffsets.push(sourceEnd);
    sourceSpans.push({ start: sourceStart, end: sourceEnd });
  });
  return { text, sourceOffsets, sourceSpans };
}

export function mapPreparedSpeechRange(
  prepared: PreparedSpeechText,
  start: number,
  end: number,
): { start: number; end: number } | null {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
    || start < 0 || end <= start || end > prepared.text.length) return null;
  const spans = prepared.sourceSpans.slice(start, end);
  const sourceStart = spans.reduce((lowest, span) => Math.min(lowest, span.start), Number.POSITIVE_INFINITY);
  const sourceEnd = spans.reduce((highest, span) => Math.max(highest, span.end), Number.NEGATIVE_INFINITY);
  if (!Number.isSafeInteger(sourceStart) || !Number.isSafeInteger(sourceEnd)) return null;
  return sourceEnd > sourceStart ? { start: sourceStart, end: sourceEnd } : null;
}

function identitySpeechText(source: string): PreparedSpeechText {
  return {
    text: source,
    sourceOffsets: Array.from({ length: source.length + 1 }, (_, index) => index),
    sourceSpans: Array.from({ length: source.length }, (_, index) => ({ start: index, end: index + 1 })),
  };
}

function isSpanishLanguage(language: string): boolean {
  const primary = language.trim().toLowerCase().split(/[-_]/u)[0];
  return !primary || primary === 'es';
}

function speechAlias(token: string): string {
  if (/^SofLIA$/iu.test(token)) return 'Soflía';
  const version = /^v\s*(\d+)\.(\d+)$/iu.exec(token);
  if (version) return `versión ${decimalWords(version[1], version[2])}`;
  const decimal = /^(\d+)\.(\d+)$/u.exec(token);
  return decimal ? decimalWords(decimal[1], decimal[2]) : token;
}

function decimalWords(integer: string, fraction: string): string {
  return `${integerWords(integer)} punto ${fractionWords(fraction)}`;
}

function fractionWords(value: string): string {
  if (value.length > 1 && value.startsWith('0')) return digitSequence(value);
  return integerWords(value);
}

function integerWords(value: string): string {
  const normalized = value.replace(/^0+(?=\d)/u, '');
  if (normalized.length > 9) return digitSequence(value);
  const numeric = Number(normalized);
  if (!Number.isSafeInteger(numeric) || numeric < 0) return digitSequence(value);
  return numberUnderBillion(numeric);
}

function numberUnderBillion(value: number): string {
  if (value < 30) return [
    'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
    'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
    'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
  ][value];
  if (value < 100) {
    const tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const unit = value % 10;
    return `${tens[Math.floor(value / 10)]}${unit ? ` y ${numberUnderBillion(unit)}` : ''}`;
  }
  if (value < 1_000) {
    if (value === 100) return 'cien';
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    const rest = value % 100;
    return `${hundreds[Math.floor(value / 100)]}${rest ? ` ${numberUnderBillion(rest)}` : ''}`;
  }
  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1_000);
    const rest = value % 1_000;
    return `${thousands === 1 ? 'mil' : `${numberUnderBillion(thousands)} mil`}${rest ? ` ${numberUnderBillion(rest)}` : ''}`;
  }
  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  return `${millions === 1 ? 'un millón' : `${numberUnderBillion(millions)} millones`}${rest ? ` ${numberUnderBillion(rest)}` : ''}`;
}

function digitSequence(value: string): string {
  return Array.from(value, (digit) => DIGIT_WORDS[Number(digit)] ?? digit).join(' ');
}

function appendSourceSlice(
  source: string,
  start: number,
  end: number,
  append: (value: string, sourceStart: number, sourceEnd: number) => void,
): void {
  for (let index = start; index < end; index += 1) append(source[index], index, index + 1);
}

function appendMappedReplacement(
  replacement: string,
  sourceStart: number,
  sourceEnd: number,
  append: (value: string, sourceOffset: number, sourceSpan: { start: number; end: number }) => void,
): void {
  const sourceLength = sourceEnd - sourceStart;
  for (let index = 0; index < replacement.length; index += 1) {
    const progress = (index + 1) / replacement.length;
    append(
      replacement[index],
      sourceStart + Math.round(progress * sourceLength),
      { start: sourceStart, end: sourceEnd },
    );
  }
}
