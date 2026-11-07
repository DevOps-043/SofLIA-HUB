import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { runPendingChatSyncPass } from './sync-pass';
import { createChatSessionReview, type ChatSessionLease, type ChatSessionReview } from './session-review';

interface SyncBatch {
  targets: Set<string> | null;
  session: ChatSessionLease;
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}
interface SyncQueue { pending: SyncBatch | null; session: ChatSessionReview }
const syncByUser = new Map<string, SyncQueue>();

/** Una pasada activa y una pendiente fusionada por identidad en este renderer. */
export async function syncPendingChatState(userId: string, conversationIds?: string[]): Promise<void> {
  if (!userId || !isSupabaseConfigured()) return;
  const targets = conversationIds?.length ? new Set(conversationIds) : null;
  const active = syncByUser.get(userId);
  const review = active?.session ?? createChatSessionReview(supabase?.auth);
  const session = review.capture(userId);
  if (active?.pending && active.pending.session.cycle === session.cycle) {
    if (targets === null) active.pending.targets = null;
    else if (active.pending.targets !== null) for (const id of targets) active.pending.targets.add(id);
    return active.pending.promise;
  }
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  const batch: SyncBatch = { targets, session, promise, resolve, reject };
  if (active) {
    // El lote anterior perdió su ciclo; conservar datos, sin heredar su scope.
    active.pending?.resolve(); active.pending = batch;
  }
  else {
    const queue: SyncQueue = { pending: batch, session: review }; syncByUser.set(userId, queue);
    void drainSyncQueue(userId, queue);
  }
  return promise;
}

async function drainSyncQueue(userId: string, queue: SyncQueue): Promise<void> {
  try {
    while (queue.pending) {
      const batch = queue.pending; queue.pending = null;
      try {
        await batch.session.ready;
        if (batch.session.isCurrent()) await runPendingChatSyncPass(userId, batch.targets, batch.session);
        batch.resolve();
      }
      catch (error) { batch.reject(error); }
    }
  } finally {
    if (syncByUser.get(userId) === queue) syncByUser.delete(userId);
    queue.session.dispose();
  }
}
