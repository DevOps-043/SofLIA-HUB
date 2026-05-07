/**
 * Helpers de extracción de información desde texto plano.
 *
 * Funciones puras — operan sobre strings/arrays sin acceso a `this`.
 * Usadas tanto por la ruta del LLM (para construir el contexto del prompt)
 * como por la ruta de fallback (parsing legacy basado en regex).
 */

import type { MeetingContextPack, MeetingTypeDefinition } from '../meeting-context-pack';
import type { MeetingParticipant, MeetingSourceArtifactRecord } from '../meeting-types';

/** Divide un texto en líneas no vacías ya trimeadas. */
export function getLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Detecta participantes a partir de líneas que empiezan con
 * "Participantes:", "Asistentes:" o "Attendees:". Soporta separación por
 * coma o punto-y-coma y extracción opcional de email.
 */
export function extractParticipants(lines: string[]): MeetingParticipant[] {
  const participants: MeetingParticipant[] = [];
  for (const line of lines) {
    if (!/^(participantes?|asistentes?|attendees?)\s*:/i.test(line)) continue;
    const names = line
      .replace(/^[^:]+:/, '')
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const name of names) {
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

/** Heurística: la primera línea con > 8 chars suele ser el título. */
export function inferTitle(lines: string[]): string | null {
  const firstLine = lines.find((line) => line.length > 8);
  return firstLine ? firstLine.slice(0, 120) : null;
}

/**
 * Construye un resumen ejecutivo cuando el LLM no produjo uno (fallback).
 * Usa las primeras 3 líneas como semilla más conteos de items extraídos.
 */
export function buildExecutiveSummary(
  lines: string[],
  commitments: number,
  decisions: number,
  issues: number,
): string {
  const seed = lines.slice(0, 3).join(' ');
  return [
    seed ? seed.slice(0, 240) : 'Reunion importada para revision.',
    `Tareas detectadas: ${commitments}.`,
    `Decisiones detectadas: ${decisions}.`,
    issues > 0 ? `Riesgos o bloqueos detectados: ${issues}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Detecta el dueño/responsable mencionado en una línea.
 * Busca tanto labels explícitos ("owner: Juan") como menciones (@juan).
 */
export function extractOwnerCandidate(line: string): string | null {
  const taggedOwner = line.match(/(?:owner|responsable|encargado|dueno|dueño)\s*[:=-]\s*([A-Za-z0-9 .@_-]+)/i);
  if (taggedOwner?.[1]) return taggedOwner[1].trim();

  const mention = line.match(/@([A-Za-z0-9._-]+)/);
  return mention?.[1] || null;
}

/**
 * Extrae fecha de vencimiento en formato ISO (YYYY-MM-DD).
 * Soporta formato ISO directo o formato dd/mm/yy(yy) que normaliza.
 */
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

/** Quita el label inicial de una línea ("Decisión:", "[ ] tarea:", etc.). */
export function stripLabel(line: string): string {
  return line
    .replace(/^(?:[-*]\s*)?(\[\s?\]\s*)?([A-Za-záéíóúñÁÉÍÓÚÑ ]+)\s*:\s*/i, '')
    .trim();
}

/* ─── Source artifact helpers ────────────────────────────────────── */

/** Descripción legible del origen del artifact (para mostrar en prompts). */
export function describeSource(sourceArtifact: MeetingSourceArtifactRecord): string {
  const metadata = sourceArtifact.metadata || {};
  const parts = [
    sourceArtifact.source_type,
    sourceArtifact.source_uri || null,
    typeof metadata.file_name === 'string' ? metadata.file_name : null,
  ].filter(Boolean);
  return parts.join(' | ') || 'Fuente sin descripcion';
}

/** Pista de fecha-hora extraída del metadata del artifact. */
export function extractDateTimeHint(sourceArtifact: MeetingSourceArtifactRecord): string | null {
  const metadata = sourceArtifact.metadata || {};
  const candidates = [metadata.created_time, metadata.imported_at, metadata.date];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

/** Lookup de definición de tipo de reunión por id. */
export function getMeetingTypeDefinition(
  contextPack: MeetingContextPack,
  meetingTypeId: string,
): MeetingTypeDefinition | null {
  return contextPack.meetingTypes.find((meetingType) => meetingType.id === meetingTypeId) || null;
}
