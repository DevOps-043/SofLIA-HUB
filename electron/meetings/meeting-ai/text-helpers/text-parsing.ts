import type { MeetingParticipant } from '../../meeting-types';

export function getLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function extractParticipants(lines: string[]): MeetingParticipant[] {
  const participants: MeetingParticipant[] = [];
  for (const line of lines) {
    if (!/^(participantes?|asistentes?|attendees?)\s*:/i.test(line)) continue;
    for (const name of splitParticipantNames(line)) {
      const emailMatch = name.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      participants.push({
        display_name: name.replace(/[<(].*$/, '').trim(),
        email: emailMatch?.[0] || null,
        external: false,
        confidence: 0.7,
      });
    }
  }
  return participants;
}

function splitParticipantNames(line: string): string[] {
  return line
    .replace(/^[^:]+:/, '')
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function inferTitle(lines: string[]): string | null {
  const firstLine = lines.find((line) => line.length > 8);
  return firstLine ? firstLine.slice(0, 120) : null;
}

export function buildExecutiveSummary(lines: string[], commitments: number, decisions: number, issues: number): string {
  const seed = lines.slice(0, 3).join(' ');
  return [
    seed ? seed.slice(0, 240) : 'Reunion importada para revision.',
    `Tareas detectadas: ${commitments}.`,
    `Decisiones detectadas: ${decisions}.`,
    issues > 0 ? `Riesgos o bloqueos detectados: ${issues}.` : null,
  ].filter(Boolean).join(' ');
}

export function extractOwnerCandidate(line: string): string | null {
  const taggedOwner = line.match(/(?:owner|responsable|encargado|dueno|due\u00f1o)\s*[:=-]\s*([A-Za-z0-9 .@_-]+)/i);
  if (taggedOwner?.[1]) return taggedOwner[1].trim();

  const mention = line.match(/@([A-Za-z0-9._-]+)/);
  return mention?.[1] || null;
}

export function extractDueDate(line: string): string | null {
  const isoDate = line.match(/(20\d{2}-\d{2}-\d{2})/);
  if (isoDate?.[1]) return isoDate[1];

  const slashDate = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!slashDate) return null;

  const day = slashDate[1].padStart(2, '0');
  const month = slashDate[2].padStart(2, '0');
  const year = slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
  return `${year}-${month}-${day}`;
}

export function stripLabel(line: string): string {
  return line
    .replace(/^(?:[-*]\s*)?(\[\s?\]\s*)?([A-Za-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00c1\u00c9\u00cd\u00d3\u00da\u00d1 ]+)\s*:\s*/i, '')
    .trim();
}
