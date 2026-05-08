/**
 * Deteccion y registro de rutinas pasivas pedidas por WhatsApp.
 *
 * Este modulo no conoce el agentic loop: recibe el servicio de workflows como
 * dependencia explicita y devuelve solamente el texto que debe enviarse.
 */

import type { WorkflowHubService } from '../workflow-hub-service';

export type PassiveWorkflowId = 'correo' | 'agenda' | 'reuniones';

export interface PassiveWorkflowIntent {
  workflowId?: PassiveWorkflowId;
  name: string;
  description: string;
  prompt: string;
  cronExpression: string;
  scheduleLabel: string;
}

export interface PassiveWorkflowRequestContext {
  workflowHubService: WorkflowHubService | null;
  senderNumber: string;
  text: string;
  isGroup: boolean;
}

export function tryHandlePassiveWorkflowRequest({
  workflowHubService,
  senderNumber,
  text,
  isGroup,
}: PassiveWorkflowRequestContext): string | null {
  if (isGroup || !workflowHubService) {
    return null;
  }

  const intent = parsePassiveWorkflowIntent(text);
  if (!intent) {
    return null;
  }

  const rule = workflowHubService.savePassiveRule({
    workflowId: intent.workflowId,
    name: intent.name,
    description: intent.description,
    prompt: intent.prompt,
    cronExpression: intent.cronExpression,
    scheduleLabel: intent.scheduleLabel,
    requestedBy: `whatsapp:${senderNumber}`,
    phoneNumber: senderNumber,
    source: 'chat',
    executionMode: 'agent_prompt',
  });

  return [
    `Listo. Lo guarde como workflow pasivo: *${rule.name}*`,
    `Cuando: ${rule.scheduleLabel}`,
    rule.workflowId ? `Tipo: ${rule.workflowName}` : 'Tipo: Rutina libre recordada',
    'No necesitas volver a pedirlo con comandos; lo voy a ejecutar solo.',
  ].join('\n');
}

export function parsePassiveWorkflowIntent(text: string): PassiveWorkflowIntent | null {
  const schedule = extractPassiveSchedule(text);
  if (!schedule) {
    return null;
  }

  const normalized = normalizeForIntent(text);
  if (!/\b(recuerdame|recuerdame|avisa|avisame|dame|enviame|mandame|prende|apaga|resume|resumeme|revisa|haz|ejecuta|prepara|busca|traeme|trae)\b/.test(normalized)) {
    return null;
  }

  const workflowId = detectPassiveWorkflowId(text);
  const compact = text.trim().replace(/\s+/g, ' ');
  const name = workflowId === 'correo'
    ? 'Resumen de correos'
    : workflowId === 'agenda'
      ? 'Briefing de agenda'
      : workflowId === 'reuniones'
        ? 'Seguimiento de reuniones'
        : compact.slice(0, 72) || 'Rutina pasiva';
  const description = workflowId
    ? `Workflow pasivo de ${workflowId} creado desde WhatsApp.`
    : 'Rutina pasiva libre creada desde WhatsApp.';

  return {
    workflowId,
    name,
    description,
    prompt: compact,
    cronExpression: schedule.cronExpression,
    scheduleLabel: schedule.scheduleLabel,
  };
}

export function detectPassiveWorkflowId(text: string): PassiveWorkflowId | undefined {
  const normalized = normalizeForIntent(text);
  if (/\b(correo|correos|gmail|bandeja|inbox)\b/.test(normalized)) {
    return 'correo';
  }
  if (/\b(agenda|calendario|calendar|briefing)\b/.test(normalized)) {
    return 'agenda';
  }
  if (/\b(reunion|reuniones|meet|meeting)\b/.test(normalized)) {
    return 'reuniones';
  }
  return undefined;
}

export function extractPassiveSchedule(text: string): { cronExpression: string; scheduleLabel: string } | null {
  const normalized = normalizeForIntent(text);

  if (/\bcada\s+(\d+)\s+hora(s)?\b/.test(normalized)) {
    const match = normalized.match(/\bcada\s+(\d+)\s+hora(s)?\b/);
    const interval = Math.max(1, Math.min(24, Number(match?.[1] || 1)));
    return {
      cronExpression: `0 */${interval} * * *`,
      scheduleLabel: `Cada ${interval} hora${interval === 1 ? '' : 's'}`,
    };
  }

  if (/\bcada\s+hora\b/.test(normalized)) {
    return {
      cronExpression: '0 * * * *',
      scheduleLabel: 'Cada hora',
    };
  }

  const time = extractClockTime(normalized);
  if (!time) {
    return null;
  }

  if (/\b(manana|manana|hoy|esta tarde|esta noche)\b/.test(normalized)
    && !/\b(cada|todos los dias|todos los dias|diario|diariamente|lunes|martes|miercoles|miercoles|jueves|viernes|sabado|sabado|domingo|entre semana|dias laborales|cada hora)\b/.test(normalized)) {
    return null;
  }

  const [hour, minute] = time;
  const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  if (/\b(lunes a viernes|lun a vie|entre semana|dias laborales)\b/.test(normalized)) {
    return {
      cronExpression: `${minute} ${hour} * * 1-5`,
      scheduleLabel: `Lunes a viernes a las ${timeLabel}`,
    };
  }

  const weekdayMap: Array<{ regex: RegExp; cron: string; label: string }> = [
    { regex: /\b(lunes|cada lunes|los lunes)\b/, cron: '1', label: 'Lunes' },
    { regex: /\b(martes|cada martes|los martes)\b/, cron: '2', label: 'Martes' },
    { regex: /\b(miercoles|miercoles|cada miercoles|cada miercoles|los miercoles|los miercoles)\b/, cron: '3', label: 'Miercoles' },
    { regex: /\b(jueves|cada jueves|los jueves)\b/, cron: '4', label: 'Jueves' },
    { regex: /\b(viernes|cada viernes|los viernes)\b/, cron: '5', label: 'Viernes' },
    { regex: /\b(sabado|sabado|cada sabado|cada sabado|los sabados|los sabados)\b/, cron: '6', label: 'Sabado' },
    { regex: /\b(domingo|cada domingo|los domingos)\b/, cron: '0', label: 'Domingo' },
  ];
  const weekday = weekdayMap.find((candidate) => candidate.regex.test(normalized));
  if (weekday) {
    return {
      cronExpression: `${minute} ${hour} * * ${weekday.cron}`,
      scheduleLabel: `${weekday.label} a las ${timeLabel}`,
    };
  }

  if (/\b(todos los dias|todos los dias|cada dia|cada dia|diario|diariamente|cada manana|cada manana|todas las mananas|todas las mananas)\b/.test(normalized)
    || /\ba las\b/.test(normalized)) {
    return {
      cronExpression: `${minute} ${hour} * * *`,
      scheduleLabel: `Todos los dias a las ${timeLabel}`,
    };
  }

  return null;
}

export function extractClockTime(normalized: string): [number, number] | null {
  const timeMatch = normalized.match(/\b(?:a las|a la|alas)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (!timeMatch) {
    return null;
  }

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || 0);
  const meridiem = timeMatch[3];
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  } else if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }

  if (hour < 0 || hour > 23) {
    return null;
  }
  return [hour, minute];
}

export function normalizeForIntent(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
