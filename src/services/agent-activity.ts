import type { AgentActivity, AgentActivityBridge } from '../shared/agent-activity';
import { activityFromTeam } from '../shared/agent-activity';
import type { TeamEvent } from '../shared/agent-teams/runner';
declare global { interface Window { agentActivity?: AgentActivityBridge } }
type LocalUpdate = { ownerId: string; activity?: AgentActivity; error?: string };
const localListeners = new Set<(update: LocalUpdate) => void>();
const monitorError = 'El monitor compartido no está disponible. Se muestra el progreso de este chat.';

function notifyLocal(update: LocalUpdate): void {
  for (const listener of localListeners) listener(update);
}

export const agentActivityService = {
  async snapshot(): Promise<AgentActivity[]> {
    if (!window.agentActivity) return [];
    const reply = await window.agentActivity.snapshot();
    if (!reply.success) throw new Error(reply.error);
    return reply.data;
  },
  subscribe(listener: (items: AgentActivity[]) => void, ownerId?: string, onError?: (error: string) => void): () => void {
    let remote: AgentActivity[] = [];
    let active = true; let remoteChanged = false; let localError = false;
    const local = new Map<string, AgentActivity>();
    const order = new Map<string, number>();
    let nextOrder = 0;
    const emit = () => {
      const merged = new Map([...local.values()].reverse().map(item => [item.id, item]));
      for (const item of remote) {
        const previous = merged.get(item.id);
        if (!previous || item.sequence > previous.sequence) merged.set(item.id, item);
      }
      const items = [...merged.values()].sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running')
        || (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
      listener(structuredClone(items.slice(0, 12)));
    };
    const receiveLocal = (update: LocalUpdate) => {
      if (!ownerId || update.ownerId !== ownerId) return;
      if (update.error !== undefined) { localError = Boolean(update.error); onError?.(update.error); }
      if (!update.activity) return;
      const item = update.activity;
      const previous = local.get(item.id) ?? remote.find(value => value.id === item.id);
      if (previous && (item.sequence <= previous.sequence || previous.status !== 'running')) return;
      if (!previous && (item.sequence !== 1 || item.status !== 'running')) return;
      if (!previous && local.size >= 12) {
        const oldest = [...local].find(([, value]) => value.status !== 'running');
        if (!oldest) return;
        local.delete(oldest[0]);
        if (!remote.some(item => item.id === oldest[0])) order.delete(oldest[0]);
      }
      if (!order.has(item.id)) order.set(item.id, ++nextOrder);
      local.set(item.id, structuredClone(item));
      emit();
    };
    localListeners.add(receiveLocal);
    const receiveRemote = (items: AgentActivity[]) => {
      remote = items;
      for (const item of [...items].reverse()) {
        if (!order.has(item.id)) order.set(item.id, ++nextOrder);
      }
      for (const item of items) {
        if (item.sequence >= (local.get(item.id)?.sequence ?? Infinity)) local.delete(item.id);
      }
      emit();
      const retained = new Set([...local.keys(), ...remote.map(item => item.id)]);
      for (const id of order.keys()) if (!retained.has(id)) order.delete(id);
      if (!localError) onError?.('');
    };
    const remove = window.agentActivity?.onChanged(items => {
      remoteChanged = true;
      if (active) receiveRemote(items);
    });
    // El snapshot y las actualizaciones comparten el mismo merge. Un snapshot
    // atrasado nunca sustituye un aviso main más reciente ni el progreso local.
    void agentActivityService.snapshot().then(items => {
      if (active && !remoteChanged) receiveRemote(items);
    }).catch(() => { if (active && !remoteChanged && !localError) onError?.('No se pudo cargar la actividad de los equipos.'); });
    return () => { active = false; localListeners.delete(receiveLocal); remove?.(); local.clear(); order.clear(); };
  },
};
export function publishTeamActivity(event: TeamEvent, ownerId?: string): void {
  if (!ownerId) return;
  const activity = activityFromTeam(event);
  // El progreso del propio chat no espera el viaje IPC; sólo expone metadatos.
  notifyLocal({ ownerId, activity: { ...activity, id: `renderer:${activity.id}` } });
  if (!window.agentActivity) { notifyLocal({ ownerId, error: monitorError }); return; }
  void window.agentActivity.publish({ ownerId, activity }).then(reply => {
    notifyLocal({ ownerId, error: reply.success ? '' : monitorError });
    if (!reply.success) console.warn('[Equipo] El monitor compartido rechazó la actualización.');
  }).catch(() => {
    notifyLocal({ ownerId, error: monitorError });
    console.warn('[Equipo] No se pudo notificar la actividad al monitor.');
  });
}
