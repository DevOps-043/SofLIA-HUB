import { VALID_ACTIONS, VALID_INTENTS, VALID_MODES } from './constants';
import type { FlowAction, FlowActionType, FlowIntent, FlowMode, RawFlowAction } from './types';

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

export function parseJsonPayload<T>(rawText: string): T {
  const normalized = rawText.trim();
  try {
    return JSON.parse(normalized) as T;
  } catch {
    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(normalized.slice(start, end + 1)) as T;
    }
    throw new Error('Respuesta JSON invalida.');
  }
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.55;
  return Math.max(0, Math.min(1, value));
}

export function normalizeIntent(value: unknown, fallback: FlowIntent): FlowIntent {
  const normalized = asString(value).toLowerCase() as FlowIntent;
  return VALID_INTENTS.includes(normalized) ? normalized : fallback;
}

export function normalizeMode(value: unknown, fallback: FlowMode): FlowMode {
  const normalized = asString(value).toLowerCase() as FlowMode;
  return VALID_MODES.includes(normalized) ? normalized : fallback;
}

export function normalizeAction(rawAction: RawFlowAction | null | undefined): FlowAction | null {
  if (!rawAction) return null;
  const type = asString(rawAction.type).toLowerCase() as FlowActionType;
  if (!VALID_ACTIONS.includes(type) || type === 'none') return null;
  return {
    type,
    label: asString(rawAction.label) || defaultActionLabel(type),
    description: asString(rawAction.description) || defaultActionDescription(type),
    target: asString(rawAction.target) || undefined,
    url: asString(rawAction.url) || undefined,
    task: asString(rawAction.task) || undefined,
    to: asString(rawAction.to) || undefined,
    subject: asString(rawAction.subject) || undefined,
    body: asString(rawAction.body) || undefined,
    attachmentPaths: asStringArray(rawAction.attachmentPaths),
    autoExecute: asBoolean(rawAction.autoExecute, false),
    requiresConfirmation: asBoolean(rawAction.requiresConfirmation, type === 'send_email'),
  };
}

function defaultActionLabel(type: FlowActionType): string {
  const labels: Record<FlowActionType, string> = {
    none: 'Continuar',
    open_application: 'Abrir aplicacion',
    open_url: 'Abrir enlace',
    send_email: 'Enviar correo',
    desktop_automation: 'Ejecutar en escritorio',
    send_to_chat: 'Mandar al chat',
  };
  return labels[type];
}

function defaultActionDescription(type: FlowActionType): string {
  const descriptions: Record<FlowActionType, string> = {
    none: '',
    open_application: 'Abrira la aplicacion solicitada en tu equipo.',
    open_url: 'Abrira el sitio o enlace solicitado.',
    send_email: 'Enviara el correo con los datos detectados.',
    desktop_automation: 'Lanzara una automatizacion guiada por el agente de escritorio.',
    send_to_chat: 'Pasara la solicitud al chat principal.',
  };
  return descriptions[type];
}
