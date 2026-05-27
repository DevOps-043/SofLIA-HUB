import { RECENT_MESSAGES_LIMIT } from './constants';

type DatabaseLike = {
  prepare: (sql: string) => {
    all: (...args: any[]) => any[];
  };
};

export interface TimelineRecallEntry {
  role: string;
  content: string;
  timestamp: number;
  score: number;
  reason: string;
}

type TemporalWindow = {
  since: number;
  until: number;
  reason: string;
};

const STOPWORDS = new Set([
  'algo',
  'antes',
  'aqui',
  'como',
  'con',
  'cuando',
  'dime',
  'dijo',
  'dijiste',
  'dos',
  'esta',
  'este',
  'esto',
  'hace',
  'historial',
  'las',
  'los',
  'mas',
  'me',
  'mio',
  'para',
  'pasada',
  'pasado',
  'que',
  'recuerda',
  'recordar',
  'semana',
  'semanas',
  'sobre',
  'te',
  'una',
  'unos',
  'vez',
]);

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

const RECALL_INTENT = /\b(recuerd|recordar|recupera|historial|conversacion|conversaciones|hablamos|dijiste|te dije|me dijiste|ayer|antier|anteayer|semana|mes|hace|pasad[ao])\b/i;

export function buildTimelineRecall(
  db: DatabaseLike | null,
  sessionKey: string,
  currentMessage: string,
  limit = RECENT_MESSAGES_LIMIT,
): TimelineRecallEntry[] {
  if (!db || !RECALL_INTENT.test(currentMessage)) return [];

  const temporalWindow = parseTemporalWindow(currentMessage);
  const terms = extractSearchTerms(currentMessage);
  const rows = loadCandidateRows(db, sessionKey, temporalWindow);
  if (rows.length === 0) return [];

  const scored = rows
    .map((row) => ({
      role: row.role,
      content: row.content,
      timestamp: Number(row.timestamp),
      score: scoreRow(row.content, terms, temporalWindow),
      reason: temporalWindow?.reason || (terms.length > 0 ? `coincide con: ${terms.join(', ')}` : 'consulta de memoria'),
    }))
    .filter((row) => temporalWindow || terms.length === 0 || row.score > 0)
    .sort((left, right) => right.score - left.score || right.timestamp - left.timestamp)
    .slice(0, Math.max(1, limit));

  return scored.sort((left, right) => left.timestamp - right.timestamp);
}

function loadCandidateRows(db: DatabaseLike, sessionKey: string, temporalWindow: TemporalWindow | null) {
  if (temporalWindow) {
    return db.prepare(`
      SELECT role, content, timestamp FROM messages
      WHERE session_key = ? AND timestamp BETWEEN ? AND ? AND content != '__RESET__'
      ORDER BY timestamp ASC
      LIMIT 300
    `).all(sessionKey, temporalWindow.since, temporalWindow.until) as Array<{ role: string; content: string; timestamp: number }>;
  }

  return db.prepare(`
    SELECT role, content, timestamp FROM messages
    WHERE session_key = ? AND content != '__RESET__'
    ORDER BY timestamp DESC
    LIMIT 500
  `).all(sessionKey) as Array<{ role: string; content: string; timestamp: number }>;
}

function scoreRow(content: string, terms: string[], temporalWindow: TemporalWindow | null): number {
  const normalized = normalizeText(content);
  const termScore = terms.reduce((score, term) => score + (normalized.includes(term) ? 2 : 0), 0);
  return termScore + (temporalWindow ? 1 : 0);
}

function extractSearchTerms(message: string): string[] {
  const normalized = normalizeText(message);
  const terms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4 && !STOPWORDS.has(term) && !/^\d+$/.test(term));
  return Array.from(new Set(terms)).slice(0, 8);
}

function parseTemporalWindow(message: string): TemporalWindow | null {
  const normalized = normalizeText(message);
  const now = new Date();

  const lastRange = normalized.match(/\b(?:ultim[ao]s?|pasad[ao]s?)\s+(\d+|[a-z]+)\s+(dia|dias|semana|semanas|mes|meses)\b/);
  if (lastRange) {
    const amount = parseSpanishNumber(lastRange[1]);
    if (amount > 0) {
      const unit = lastRange[2];
      const days = unit.startsWith('semana') ? amount * 7 : unit.startsWith('mes') ? amount * 30 : amount;
      return { since: addDays(now, -days).getTime(), until: now.getTime(), reason: `ultimos ${amount} ${unit}` };
    }
  }

  const ago = normalized.match(/\bhace\s+(\d+|[a-z]+)\s+(dia|dias|semana|semanas|mes|meses)\b/);
  if (ago) {
    const amount = parseSpanishNumber(ago[1]);
    if (amount > 0) {
      const unit = ago[2];
      if (unit.startsWith('dia')) return dayWindow(addDays(now, -amount), `hace ${amount} dias`);
      if (unit.startsWith('semana')) return paddedDayWindow(addDays(now, -(amount * 7)), 2, `hace ${amount} semanas`);
      return paddedDayWindow(addDays(now, -(amount * 30)), 5, `hace ${amount} meses`);
    }
  }

  if (/\b(ayer)\b/.test(normalized)) return dayWindow(addDays(now, -1), 'ayer');
  if (/\b(antier|anteayer)\b/.test(normalized)) return dayWindow(addDays(now, -2), 'antier');
  if (/\bsemana pasada\b/.test(normalized)) {
    return { since: addDays(now, -14).getTime(), until: addDays(now, -7).getTime(), reason: 'semana pasada' };
  }
  if (/\bmes pasado\b/.test(normalized)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { since: start.getTime(), until: end.getTime(), reason: 'mes pasado' };
  }

  const explicitDate = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const year = explicitDate[3] ? normalizeYear(Number(explicitDate[3])) : now.getFullYear();
    return dayWindow(new Date(year, month, day), `fecha ${explicitDate[0]}`);
  }

  return null;
}

function parseSpanishNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  return NUMBER_WORDS[value] || 0;
}

function normalizeYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

function dayWindow(date: Date, reason: string): TemporalWindow {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { since: start.getTime(), until: end.getTime(), reason };
}

function paddedDayWindow(date: Date, paddingDays: number, reason: string): TemporalWindow {
  const start = addDays(date, -paddingDays);
  start.setHours(0, 0, 0, 0);
  const end = addDays(date, paddingDays);
  end.setHours(23, 59, 59, 999);
  return { since: start.getTime(), until: end.getTime(), reason };
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
