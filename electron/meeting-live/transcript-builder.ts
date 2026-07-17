/**
 * Construccion del transcript de una reunion en vivo (funciones puras).
 *
 * El resultado es texto plano estructurado que entra al pipeline de meetings
 * existente como fuente manual: MeetingAIService genera de ahi el resumen
 * ejecutivo y la minuta, igual que con un transcript importado de Drive.
 */
import type { MeetingLiveScreenshot, MeetingLiveSegment } from './types';

/**
 * Etiqueta legible del hablante: "usuario" → Usuario; "participante-3" →
 * Participante 3 (diarizacion por huella de voz); cualquier otro valor cae a
 * la etiqueta generica de participantes remotos.
 */
export function formatSpeakerLabel(segment: MeetingLiveSegment): string {
  if (segment.speaker === 'usuario' || segment.source === 'mic') return 'Usuario';
  const match = /^participante-(\d+)$/.exec(segment.speaker);
  if (match) return `Participante ${match[1]}`;
  return 'Participantes';
}

/** Maximo de texto OCR por captura dentro del transcript (evita inflar tokens). */
const MAX_OCR_CHARS_PER_SHOT = 600;

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * true si el OCR nuevo aporta contenido distinto al anterior. Las reuniones
 * suelen mostrar la misma slide varios minutos: capturas identicas no deben
 * repetirse en el contexto del resumen.
 */
export function isMeaningfulOcrChange(previous: string, next: string): boolean {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedNext = normalize(next);
  if (normalizedNext.length < 20) return false;
  const normalizedPrevious = normalize(previous);
  if (!normalizedPrevious) return true;
  if (normalizedNext === normalizedPrevious) return false;
  // Solapamiento burdo por tokens: >80% de palabras compartidas = misma slide.
  const previousTokens = new Set(normalizedPrevious.split(' '));
  const nextTokens = normalizedNext.split(' ');
  const shared = nextTokens.filter((token) => previousTokens.has(token)).length;
  return shared / nextTokens.length <= 0.8;
}

export function buildMeetingTranscript(input: {
  title: string;
  startedAt: string;
  endedAt: string;
  segments: MeetingLiveSegment[];
  screenshots: MeetingLiveScreenshot[];
  /** Nombres confirmados por OCR de los tiles de la reunion (2+ capturas). */
  participantsDetected?: string[];
}): string {
  const distinctSpeakers = new Set(
    input.segments.filter((s) => /^participante-\d+$/.test(s.speaker)).map((s) => s.speaker),
  );
  const participants = input.participantsDetected ?? [];
  const lines: string[] = [
    `Reunion: ${input.title}`,
    `Inicio: ${input.startedAt}`,
    `Fin: ${input.endedAt}`,
    '',
    '=== NOTA PARA EL ANALISIS ===',
    '"Usuario" es quien tomo las notas (hablo por el microfono local).',
    distinctSpeakers.size > 0
      ? `Los hablantes remotos fueron separados automaticamente por huella de voz como Participante 1..${distinctSpeakers.size}. Las etiquetas son consistentes pero anonimas: si el contexto revela nombres reales (se presentan, se mencionan entre si, responden preguntas dirigidas), usa los nombres reales en el resumen y la minuta indicando la correspondencia.`
      : 'Los hablantes remotos no pudieron separarse por voz y aparecen agrupados como "Participantes"; infiere del contexto quien dijo que cuando sea posible.',
  ];
  if (participants.length > 0) {
    lines.push(
      `PARTICIPANTES DETECTADOS EN PANTALLA (OCR de los tiles de la reunion): ${participants.join(', ')}.`,
      'Estos son los nombres reales mas probables de los hablantes remotos: usa la linea de tiempo "EN PANTALLA" y el contenido de la conversacion para asignar cada "Participante N" a uno de estos nombres.',
    );
  }
  lines.push('', '=== TRANSCRIPCION (capturada en vivo por SofLIA) ===');

  const ordered = [...input.segments].sort((a, b) => a.t0Ms - b.t0Ms || a.t1Ms - b.t1Ms);
  for (const segment of ordered) {
    const text = segment.text.trim();
    if (!text) continue;
    lines.push(`[${formatTimestamp(segment.t0Ms)}] ${formatSpeakerLabel(segment)}: ${text}`);
  }

  // Linea de tiempo de nombres visibles: permite correlacionar temporalmente
  // "Participante N" (huella de voz) con los nombres reales en pantalla. Solo
  // se emite cuando el conjunto de nombres cambia, para no inflar el contexto.
  let previousNamesKey = '';
  const nameTimeline: string[] = [];
  for (const shot of input.screenshots) {
    if (shot.namesVisible.length === 0) continue;
    const key = [...shot.namesVisible].sort().join('|').toLowerCase();
    if (key === previousNamesKey) continue;
    previousNamesKey = key;
    nameTimeline.push(`[${formatTimestamp(shot.capturedAtMs)}] EN PANTALLA: ${shot.namesVisible.join(', ')}`);
  }
  if (nameTimeline.length > 0) {
    lines.push('', '=== NOMBRES VISIBLES EN LA REUNION (linea de tiempo) ===', ...nameTimeline);
  }

  const shotsWithText = input.screenshots.filter((shot) => shot.ocrText.trim().length > 0);
  if (shotsWithText.length > 0) {
    lines.push('', '=== CONTENIDO VISIBLE EN PANTALLA (OCR de capturas periodicas) ===');
    for (const shot of shotsWithText) {
      const excerpt = shot.ocrText.trim().slice(0, MAX_OCR_CHARS_PER_SHOT);
      lines.push(`[${formatTimestamp(shot.capturedAtMs)}] ${excerpt}`);
    }
  }

  return lines.join('\n');
}
