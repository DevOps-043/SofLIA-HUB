import { execFileAsync } from './process-exec';
import type { BackgroundProcessContext } from './runtime';
import type { ManagedSessionView } from './types';

export async function listSessions(context: BackgroundProcessContext): Promise<ManagedSessionView[]> {
  await context.ensureSessionsLoaded();
  const sessions = Array.from(context.sessions.values())
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const views: ManagedSessionView[] = [];
  for (const session of sessions) views.push(await context.toView(session));
  return views;
}

export async function getSession(
  context: BackgroundProcessContext,
  sessionId: string,
): Promise<ManagedSessionView | null> {
  await context.ensureSessionsLoaded();
  const session = context.sessions.get(sessionId);
  return session ? context.toView(session) : null;
}

export async function killSession(
  context: BackgroundProcessContext,
  sessionId: string,
): Promise<ManagedSessionView | null> {
  await context.ensureSessionsLoaded();
  const session = context.sessions.get(sessionId);
  if (!session) return null;
  await context.refreshSession(session);
  if (!session.pid || session.status !== 'running') return context.toView(session);
  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill.exe', ['/PID', String(session.pid), '/T', '/F'], {
        timeout: 10000,
        windowsHide: true,
        maxBuffer: 1024 * 128,
      });
    } else {
      process.kill(session.pid, 'SIGTERM');
    }
    session.status = 'killed';
    session.endedAt = new Date().toISOString();
    await context.persistSession(session);
  } catch (error: any) {
    session.lastError = error?.stderr?.trim() || error?.stdout?.trim() || error?.message || 'No se pudo terminar la sesion.';
    await context.persistSession(session);
  }
  return context.toView(session);
}
