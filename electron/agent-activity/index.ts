import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { subscribeTeamEvents } from '../../src/shared/agent-teams/runner';
import { activityFromTeam, type AgentActivity } from '../../src/shared/agent-activity';
import type { AgentHarness } from '../agent-runtime/service';
import { ActivityStore, activitySchema } from './store';
import { ActivityWindow } from './window';

export function initializeAgentActivity(input: {
  getWindow(): BrowserWindow | null; getUserId(): string | null;
  getOrbWindow?(): BrowserWindow | null;
  onAuthChange(listener: () => void): () => void; harness: AgentHarness;
}): () => void {
  const store = new ActivityStore(); const view = new ActivityWindow(input.getWindow);
  const meetingSequences = new Map<string, number>();
  let owner = input.getUserId();
  const reset = () => { owner = input.getUserId(); store.clear(); meetingSequences.clear(); view.destroy(); notify(); };
  const notify = () => {
    for (const win of [input.getWindow(), view.window]) {
      try {
        if (win && !win.isDestroyed()) win.webContents.send('agent-activity:changed', store.snapshot());
      } catch { console.warn('[Equipo] No se pudo actualizar una vista del monitor.'); }
    }
  };
  const accept = (origin: 'main' | 'renderer' | 'orb' | 'meeting', value: AgentActivity) => {
    if (owner !== input.getUserId()) reset();
    if (!owner || !store.accept(origin, value)) return;
    if (value.sequence === 1) {
      try { view.show(); } catch { console.warn('[Equipo] No se pudo abrir el monitor.'); }
    }
    notify();
  };
  const unsubscribe = subscribeTeamEvents(event => accept('main', activityFromTeam(event)));
  const meetingChanged = () => {
    if (!input.getUserId()) return;
    const runs = input.harness.snapshot();
    const visible = new Set(runs.filter(run => run.scope.userId === input.getUserId()).map(run => run.id));
    for (const previous of store.snapshot()) {
      if (previous.surface !== 'meetings' || previous.status !== 'running') continue;
      const id = previous.id.slice('meeting:'.length);
      if (!visible.has(id)) accept('meeting', { ...previous, id, sequence: previous.sequence + 1,
        status: 'cancelled', agents: previous.agents.map(agent => ({ ...agent,
          status: agent.status === 'running' || agent.status === 'pending' ? 'cancelled' : agent.status })) });
    }
    for (const run of runs) {
      if (run.scope.userId !== input.getUserId()) continue;
      if (!meetingSequences.has(run.id) && run.status !== 'running') continue;
      const sequence = (meetingSequences.get(run.id) ?? 0) + 1;
      meetingSequences.set(run.id, sequence);
      accept('meeting', { id: run.id, sequence, surface: 'meetings', kind: 'meeting',
        status: run.status === 'running' ? 'running' : run.status === 'review' ? 'completed' : run.status === 'cancelled' ? 'cancelled' : 'partial',
        agents: run.steps.map(step => ({ role: step.role, status: step.status })),
        durationMs: Math.max(0, (run.status === 'running' ? Date.now() : Date.parse(run.updatedAt)) - Date.parse(run.createdAt)),
      });
    }
  };
  input.harness.on('changed', meetingChanged);
  const removeAuth = input.onAuthChange(reset);
  const channels: string[] = [];
  const isMainFrame = (event: IpcMainInvokeEvent, win: BrowserWindow | null | undefined) => Boolean(win && !win.isDestroyed()
    && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame);
  const publisherOrigin = (event: IpcMainInvokeEvent): 'renderer' | 'orb' | null => {
    if (isMainFrame(event, input.getWindow())) return 'renderer';
    if (isMainFrame(event, input.getOrbWindow?.())) return 'orb';
    return null;
  };
  const register = <T>(name: string, schema: z.ZodType<T>, publishOnly: boolean, action: (value: T, event: IpcMainInvokeEvent) => void) => {
    channels.push(name);
    ipcMain.handle(name, (event, payload: unknown) => {
      const authorized = input.getUserId() && (publisherOrigin(event) || (!publishOnly && isMainFrame(event, view.window)));
      if (!authorized) return { success: false, error: 'Superficie no autorizada.' };
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return { success: false, error: 'Solicitud inválida.' };
      try {
        if (owner !== input.getUserId()) reset();
        action(parsed.data, event);
        return { success: true, data: store.snapshot() };
      } catch { return { success: false, error: 'No se pudo actualizar el monitor.' }; }
    });
  };
  register('agent-activity:snapshot', z.undefined(), false, () => {});
  register('agent-activity:publish', z.object({ ownerId: z.string().min(1).max(100), activity: activitySchema }).strict(), true, (payload, event) => {
    if (payload.ownerId !== input.getUserId()) throw new Error('Sesión anterior.');
    const origin = publisherOrigin(event);
    if (!origin) throw new Error('Publicador no disponible.');
    // La procedencia se determina en main, nunca a partir de etiquetas del renderer.
    accept(origin, { ...payload.activity, surface: origin === 'orb' ? 'orb' : 'chat' });
  });
  register('agent-activity:control', z.enum(['show', 'hide', 'minimize']), false, action => {
    if (action === 'show') view.show(); else if (action === 'hide') view.hide(); else view.minimize();
  });
  const close = () => {
    unsubscribe(); removeAuth(); input.harness.off('changed', meetingChanged);
    channels.forEach(channel => ipcMain.removeHandler(channel)); view.destroy(); store.clear(); app.off('before-quit', close);
  };
  app.once('before-quit', close);
  return close;
}
