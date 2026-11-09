import type { CalendarService } from '../calendar-service';
import { calendarSession } from '../calendar/session-context';
import type { GmailClient } from './types';
import type { GmailRequestOptions } from './client-types';

const WORK_BUDGET_MS = 90_000;
const REQUEST_TIMEOUT_MS = 15_000;
export interface GmailOperationAuthorization {
  userId: string;
  assertCurrent(): void;
  signal?: AbortSignal;
  approve?(detail: string, assertCurrent: () => void): Promise<boolean>;
}
export interface GmailExecutionContext {
  owner: { userId: string; email: string };
  assert(): void;
  approve(detail: string): Promise<boolean>;
  call<T>(operation: (client: GmailClient) => Promise<T>): Promise<T>;
  requestOptions(): GmailRequestOptions;
}
export function gmailExecutionContext(calendar: CalendarService,
  getClient: () => Promise<{ client?: GmailClient; error?: string }>, authorization?: GmailOperationAuthorization): GmailExecutionContext {
  const connection = calendar.connections.get('google');
  if (!connection?.isActive || !calendar.userId || connection.userId !== calendar.userId || !connection.email
    || (authorization && authorization.userId !== calendar.userId)) throw new Error('Cuenta Gmail no disponible.');
  const owner = { userId: calendar.userId, email: connection.email };
  const sessionAssert = calendarSession(calendar, connection);
  let deadline: number | undefined;
  let budgetSignal: AbortSignal | undefined;
  const assert = () => {
    sessionAssert(); authorization?.assertCurrent();
    if (authorization?.signal?.aborted || budgetSignal?.aborted) throw new Error('La operación Gmail fue cancelada.');
    if (connection.email !== owner.email) throw new Error('La cuenta Gmail cambió.');
    if (deadline !== undefined && Date.now() >= deadline) throw new Error('Se agotó el presupuesto de Gmail.');
  };
  let client: Promise<GmailClient> | undefined;
  return {
    owner, assert,
    approve: async detail => {
      assert();
      // La espera humana tiene su propia vigencia; no consume el presupuesto de red.
      deadline = undefined; budgetSignal = undefined;
      const approved = authorization?.approve ? await authorization.approve(`Cuenta: ${owner.email}\n${detail}`, assert) : true;
      assert(); return approved;
    },
    call: async operation => {
      if (deadline === undefined) { deadline = Date.now() + WORK_BUDGET_MS; budgetSignal = AbortSignal.timeout(WORK_BUDGET_MS); }
      assert();
      client ??= getClient().then(result => { assert(); if (!result.client) throw new Error('Cliente Gmail no disponible.'); return result.client; });
      const current = await client; assert();
      const result = await operation(current); assert(); return result;
    },
    requestOptions: () => {
      assert();
      const timeout = Math.min(REQUEST_TIMEOUT_MS, Math.max(1, (deadline ?? Date.now() + WORK_BUDGET_MS) - Date.now()));
      const signals = [AbortSignal.timeout(timeout), ...(budgetSignal ? [budgetSignal] : []), ...(authorization?.signal ? [authorization.signal] : [])];
      return { timeout, retry: false, signal: AbortSignal.any(signals) };
    },
  };
}
