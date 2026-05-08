import crypto from 'node:crypto';
import type {
  WorkflowActionKind,
  WorkflowActionRecord,
} from '../types';

export interface GeneratedCustomAction {
  kind: WorkflowActionKind;
  title: string;
  payload: Record<string, any>;
}

export function getActionTitle(action: GeneratedCustomAction): string {
  return String(action.title || '').trim() || 'Accion personalizada';
}

export function getPayloadObject(action: GeneratedCustomAction): Record<string, any> {
  return action.payload && typeof action.payload === 'object'
    ? { ...action.payload }
    : {};
}

export function getStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

export function createPendingAction(
  kind: WorkflowActionKind,
  title: string,
  payload: Record<string, any>,
): WorkflowActionRecord {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    status: 'pending',
    payload,
  };
}
