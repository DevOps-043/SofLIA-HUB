import { AsyncLocalStorage } from 'node:async_hooks';
import type { ChannelActorInput, ResolvedChannelPrincipal } from './types';

interface Operation { actor: ChannelActorInput; signal: AbortSignal; assert(): void; confirm(detail: string): Promise<boolean> }
const operations = new AsyncLocalStorage<Operation>();
export function withCommunicationOperation<T>(operation: Operation, action: () => T): T { return operations.run(operation, action); }
/** Transportes/singletons persistentes no heredan la lease temporal del IPC. */
export function withoutCommunicationOperation<T>(action: () => T): T { return operations.exit(action); }
export function communicationOperation() { const op = operations.getStore(); op?.assert(); return op; }
export function assertCommunicationOperation(): void { operations.getStore()?.assert(); }
export function assertCommunicationPrincipal(principal: ResolvedChannelPrincipal): void {
  const op = communicationOperation();
  if (op && (principal.source !== 'sofia' || !principal.active || !['owner', 'admin', 'member'].includes(principal.role) || principal.userId !== op.actor.userId || op.actor.organizationId && principal.organizationId !== op.actor.organizationId)) throw new Error('Principal de comunicación no autorizado.');
}
export function requireCommunicationOrganization(): void {
  const op = communicationOperation(); if (op && !op.actor.organizationId) throw new Error('Selecciona una organización vigente.');
}
export async function confirmCommunicationEffect(detail: string): Promise<void> {
  const op = communicationOperation(); if (!op) return;
  if (!await op.confirm(detail)) throw new Error('Acción de comunicación cancelada.'); op.assert();
}
