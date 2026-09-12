import { randomUUID } from 'node:crypto';
import type { BrowserSyncCategory } from './platform-types';
import type { BrowserSyncCrypto, BrowserSyncPayload } from './sync-crypto';
import type { BrowserSyncRemote } from './sync-remote';
import { assertSyncActive, BrowserSyncError } from './sync-remote';
import { BrowserSyncCheckpointStore, type SyncCheckpoint } from './sync-checkpoint-store';
import { BrowserSyncConflictStore } from './sync-conflict-store';
import { sameSyncPayload, type BrowserSyncLocalAdapter } from './sync-local-adapter';
import { normalizeSyncCategories } from './sync-settings-store';

export interface BrowserSyncClientResult {
  state: 'idle' | 'conflict' | 'initial-review' | 'local-changed';
  completed: BrowserSyncCategory[];
  initialCategories: BrowserSyncCategory[];
  conflicts: Array<{ reviewId: string; category: BrowserSyncCategory; count: number }>;
}
/** Una pasada explícita; el checkpoint precede cada escritura remota. */
export class BrowserSyncClient {
  constructor(private readonly dependencies: { checkpoints: BrowserSyncCheckpointStore; crypto: Pick<BrowserSyncCrypto, 'encrypt' | 'decrypt'>; local: BrowserSyncLocalAdapter; conflicts: BrowserSyncConflictStore }) {}
  async synchronize(input: {
    categories: BrowserSyncCategory[];
    remote: Pick<BrowserSyncRemote, 'active' | 'read' | 'put'>;
    binding: { ownerId: string; origin: string };
    signal: AbortSignal; guard: () => void;
    initialResolution?: Partial<Record<BrowserSyncCategory, 'local' | 'remote'>>;
    conflictResolution?: Record<string, 'local' | 'remote'>;
  }): Promise<BrowserSyncClientResult> {
    const { checkpoints, crypto, local, conflicts } = this.dependencies;
    const guard = () => assertSyncActive(input.signal, input.guard);
    guard();
    const categories = normalizeSyncCategories(input.categories);
    if (!await input.remote.active(input.signal)) throw new BrowserSyncError('El dispositivo no está autorizado para sincronizar.');
    const journal = await checkpoints.read(input.binding); guard();
    const result: BrowserSyncClientResult = { state: 'idle', completed: [], initialCategories: [], conflicts: [] };
    for (const category of categories) {
      guard();
      let entry = journal.categories[category];
      let completed = false;
      for (let attempt = 0; attempt < 3 && !completed; attempt++) {
        const current = await local.read(category); guard();
        if (entry?.pending) {
          const pending = entry.pending;
          const receipt = await input.remote.put(pending.envelope, pending.revision, pending.idempotencyKey, pending.traceId, input.signal); guard();
          if (receipt.status === 'conflict') {
            const newer = await input.remote.read(category, input.signal); guard();
            if (!newer || newer.revision <= pending.revision) throw new BrowserSyncError('El servidor no entregó la revisión concurrente esperada.');
            if (entry.revision === 0 && !pending.reviewId) {
              entry.initial = { revision: newer.revision, remote: await crypto.decrypt(newer.envelope) as BrowserSyncPayload, local: current };
              delete entry.pending; await checkpoints.write(journal, guard);
              result.initialCategories.push(category); result.state = 'initial-review'; break;
            }
            if (pending.reviewId) {
              const payload = await crypto.decrypt(newer.envelope);
              const review = pending.rebaseBase !== undefined
                ? await conflicts.refreshLocal(pending.reviewId, { category, baseRevision: pending.revision, remoteRevision: newer.revision, base: pending.rebaseBase, local: pending.next, remote: payload }, guard)
                : await conflicts.rebase(pending.reviewId, { category, revision: newer.revision, payload }, guard, pending.next);
              if (pending.rebaseBase !== undefined) { entry.revision = pending.revision; entry.base = pending.rebaseBase; }
              entry.review = { id: review.reviewId, local: pending.local };
            }
            delete entry.pending;
            await checkpoints.write(journal, guard);
            continue;
          }
          // Un replay debe completar también la persistencia local tras un fallo de disco.
          const actual = await local.read(category); guard();
          if (!sameSyncPayload(actual, pending.local) && !sameSyncPayload(actual, pending.next)) {
            const choice = input.initialResolution?.[category];
            const review = entry.initial;
            if (choice && review?.revision === receipt.revision && sameSyncPayload(review.local, actual) && sameSyncPayload(review.remote, pending.next)) {
              entry.pending = await this.pending(category, receipt.revision, actual, choice === 'local' ? actual : pending.next, pending.reviewId);
              if (pending.reviewId) {
                entry.pending.reviewRevision = pending.reviewRevision ?? receipt.revision;
                entry.pending.rebaseBase = pending.next;
              }
              delete entry.initial; await checkpoints.write(journal, guard); continue;
            }
            entry.initial = { revision: receipt.revision, remote: pending.next, local: actual };
            await checkpoints.write(journal, guard);
            result.initialCategories.push(category); result.state = 'local-changed'; break;
          }
          if (!await local.compareAndApply(category, actual, pending.next, guard)) { result.state = 'local-changed'; break; }
          guard();
          if (pending.reviewId) {
            const reviews = await conflicts.list(); guard();
            if (reviews.some((review) => review.reviewId === pending.reviewId)) await conflicts.acknowledge(pending.reviewId, pending.reviewRevision ?? receipt.revision, guard);
          }
          entry = { revision: receipt.revision, base: pending.next };
          journal.categories[category] = entry;
          await checkpoints.write(journal, guard);
          completed = true; break;
        }
        const remote = await input.remote.read(category, input.signal); guard();
        const remotePayload = remote ? await crypto.decrypt(remote.envelope) as BrowserSyncPayload : category === 'settings' ? {} : [];
        guard();
        if (!entry || entry.initial) {
          if (remote) {
            const initial = entry?.initial;
            const choice = input.initialResolution?.[category];
            if (!initial || initial.revision !== remote.revision || !sameSyncPayload(initial.remote, remotePayload) || !sameSyncPayload(initial.local, current) || !choice) {
              entry = { revision: 0, base: category === 'settings' ? {} : [], initial: { revision: remote.revision, remote: remotePayload, local: current } };
              journal.categories[category] = entry; await checkpoints.write(journal, guard);
              result.initialCategories.push(category); if (result.state === 'idle') result.state = 'initial-review'; break;
            }
            if (!['local', 'remote'].includes(choice)) throw new BrowserSyncError('La elección inicial es inválida.');
            entry = entry!;
            entry.pending = await this.pending(category, remote.revision, current, choice === 'local' ? current : remotePayload);
            delete entry.initial;
          } else {
            entry = { revision: 0, base: category === 'settings' ? {} : [], pending: await this.pending(category, 0, current, current) };
          }
          journal.categories[category] = entry; await checkpoints.write(journal, guard); continue;
        }
        if (!remote || remote.revision < entry.revision) throw new BrowserSyncError('Se perdió o retrocedió una base remota conocida. No se sobrescribió.');
        if (!entry.review && remote.revision > entry.revision && sameSyncPayload(current, remotePayload)) {
          // Otro equipo ya publicó el mismo contenido: avanzar la base sin un eco de escritura.
          entry = { revision: remote.revision, base: current };
          journal.categories[category] = entry; await checkpoints.write(journal, guard);
          completed = true; break;
        }
        if (entry.review) {
          if (!sameSyncPayload(entry.review.local, current)) {
            const refreshed = await conflicts.refreshLocal(entry.review.id, { category, baseRevision: entry.revision, remoteRevision: remote.revision, base: entry.base, local: current, remote: remotePayload }, guard);
            entry.review = { id: refreshed.reviewId, local: current };
            await checkpoints.write(journal, guard);
            // La aprobación del contenido anterior no autoriza esta nueva revisión.
            result.conflicts.push({ reviewId: refreshed.reviewId, category, count: refreshed.unresolved });
            result.state = 'conflict'; break;
          }
          let review = (await conflicts.list()).find((value) => value.reviewId === entry!.review!.id); guard();
          if (!review) throw new BrowserSyncError('La revisión pendiente no está disponible. Se conserva el checkpoint.');
          const choice = input.conflictResolution?.[review.reviewId];
          if (choice) {
            if (!['local', 'remote'].includes(choice)) throw new BrowserSyncError('La decisión es inválida.');
            review = await conflicts.resolve(review.reviewId, review.conflicts.map((conflict) => ({ conflictId: conflict.id, side: choice })), guard);
          }
          if (review.status !== 'ready' || !review.payload) { result.conflicts.push({ reviewId: review.reviewId, category, count: review.unresolved }); result.state = 'conflict'; break; }
          if (review.remoteRevision !== remote.revision) {
            review = await conflicts.rebase(review.reviewId, { category, revision: remote.revision, payload: remotePayload }, guard);
            entry.review.id = review.reviewId; await checkpoints.write(journal, guard); continue;
          }
          entry.pending = await this.pending(category, remote.revision, current, review.payload, review.reviewId);
          await checkpoints.write(journal, guard); continue;
        }
        if (remote.revision === entry.revision) {
          if (!sameSyncPayload(entry.base, remotePayload)) throw new BrowserSyncError('La base remota cambió sin actualizar su revisión.');
          if (sameSyncPayload(current, entry.base)) { completed = true; break; }
          entry.pending = await this.pending(category, remote.revision, current, current);
        } else {
          const review = await conflicts.prepare({ category, baseRevision: entry.revision, remoteRevision: remote.revision, base: entry.base, local: current, remote: remotePayload }, guard);
          entry.review = { id: review.reviewId, local: current };
        }
        await checkpoints.write(journal, guard);
      }
      if (completed) result.completed.push(category);
      else if (result.state === 'idle') result.state = 'local-changed';
    }
    guard(); return result;
  }
  private async pending(category: BrowserSyncCategory, revision: number, local: BrowserSyncPayload, next: BrowserSyncPayload, reviewId?: string): Promise<NonNullable<SyncCheckpoint['pending']>> {
    next = await this.dependencies.local.prepare?.(category, next) ?? next;
    return { revision, local, next, envelope: await this.dependencies.crypto.encrypt({ category, payload: next }), idempotencyKey: randomUUID(), traceId: randomUUID(), ...(reviewId ? { reviewId } : {}) };
  }
}
