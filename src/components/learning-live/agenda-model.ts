import type { LiveCatalog, LiveCatalogSession } from '../../shared/learning-live-catalog';

export type AgendaTab = 'personal' | 'management' | 'history';
export const sessionEnd = (session: LiveCatalogSession) =>
  Date.parse(session.starts_at) + session.duration_minutes * 60_000;

/** Defensa visual para servidores antiguos; Learning filtra antes de paginar. */
export function visibleAgendaSessions(
  sessions: LiveCatalogSession[],
  history: boolean,
  now: number,
): LiveCatalogSession[] {
  return sessions
    .filter((session) =>
      history
        ? session.status === 'ended' || session.status === 'cancelled' || (session.status === 'scheduled' && sessionEnd(session) <= now)
        : session.status === 'live' || (session.status === 'scheduled' && sessionEnd(session) > now),
    )
    .sort((a, b) =>
      history
        ? Date.parse(b.starts_at) - Date.parse(a.starts_at)
        : Number(b.status === 'live') - Number(a.status === 'live') ||
          Date.parse(a.starts_at) - Date.parse(b.starts_at),
    );
}

export function agendaPermissions(catalog?: LiveCatalog) {
  return {
    canManage: catalog?.can_teach === true && catalog.capabilities?.can_manage !== false,
    canViewHistory: catalog?.can_teach === true && catalog.capabilities?.can_view_history === true,
    role: catalog?.capabilities?.role,
  };
}

/** Solo rutas conocidas de Learning, construidas por main; nunca URLs de una sesión. */
export function managementPageUrl(
  catalog: LiveCatalog | undefined,
  slug: string | undefined,
  sessionId?: string,
): string | null {
  if (!catalog?.management_url || !catalog.can_teach || !catalog.capabilities?.can_manage || !slug)
    return null;
  try {
    const url = new URL(catalog.management_url);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !local) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== `/${slug}/instructor`
    )
      return null;
    if (sessionId) {
      if (!catalog.sessions.some((session) => session.id === sessionId)) return null;
      url.pathname = `/${slug}/live/${sessionId}`;
    }
    return url.toString();
  } catch {
    return null;
  }
}
