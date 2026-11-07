import type { CalendarService } from '../calendar-service';
import type { GmailClient } from './types';
import { GmailPlanStore, GmailPlanStorageError, type GmailPlanAccount } from './plan-storage';
import type { PrivateGmailPlan } from './plan-schema';
import { z } from 'zod';
import { gmailObjectId } from './plan-schema';
import { gmailExecutionContext, type GmailExecutionContext, type GmailOperationAuthorization } from './execution-context';

const METADATA_CONCURRENCY = 8;

export type GmailPlanAuthorization = GmailOperationAuthorization;
export interface GmailPlanContext extends GmailExecutionContext {
  store: GmailPlanAccount;
}

export function gmailPlanContext(calendar: CalendarService, store: GmailPlanStore,
  getClient: () => Promise<{ client?: GmailClient; error?: string }>, authorization?: GmailPlanAuthorization): GmailPlanContext {
  const context = gmailExecutionContext(calendar, getClient, authorization);
  return { ...context, store: store.account(context.owner) };
}

const labelsSchema = z.array(gmailObjectId).max(100);
const planLabelSchema = z.object({ id: gmailObjectId, name: z.string().min(1).max(225) });
export const parsePlanLabel = (value: unknown) => planLabelSchema.parse(value);
export async function currentGmailLabels(context: GmailPlanContext) {
  const response = await context.call(client => client.users.labels.list({ userId: 'me' }, context.requestOptions()));
  return z.array(planLabelSchema).max(10000).parse(response.data.labels ?? []);
}
export async function currentMessageLabels(context: GmailPlanContext, id: string): Promise<string[]> {
  const response = await context.call(client => client.users.messages.get({ userId: 'me', id, format: 'minimal' }, context.requestOptions()));
  const message = z.object({ id: gmailObjectId, labelIds: labelsSchema.optional() }).parse(response.data);
  if (message.id !== id) throw new Error('Respuesta de mensaje incompatible.');
  return [...new Set(message.labelIds ?? [])];
}

export async function persistPlanFailure(context: GmailPlanContext, plan: PrivateGmailPlan): Promise<void> {
  plan.status = 'partial';
  // Cierre contable al owner/ruta capturados, sin nuevos efectos remotos ni otra cuenta.
  await context.store.save(plan, () => {});
}

export async function currentBatchLabels(context: GmailPlanContext, ids: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (let offset = 0; offset < ids.length; offset += METADATA_CONCURRENCY) {
    const chunk = ids.slice(offset, offset + METADATA_CONCURRENCY);
    const labels = await Promise.all(chunk.map(id => currentMessageLabels(context, id)));
    context.assert(); chunk.forEach((id, index) => result.set(id, labels[index]));
  }
  return result;
}

export const GMAIL_PLAN_FAILURE = 'No se pudo completar el plan Gmail. Revisa la cuenta, el plan y la confirmación.';
export const publicPlanError = (error: unknown) => error instanceof GmailPlanStorageError ? error.message : GMAIL_PLAN_FAILURE;
export const GMAIL_PLAN_RECOVERY = 'El plan quedó incompleto. Revisa los cambios en Gmail antes de continuar; se conservó el registro de recuperación.';
