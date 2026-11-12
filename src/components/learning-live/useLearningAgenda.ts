import { useEffect, useState } from 'react';
import { learningLiveService } from '../../services/learning-live-service';
import type { LiveCatalog } from '../../shared/learning-live-catalog';
import {
  agendaPermissions,
  sessionEnd,
  visibleAgendaSessions,
  type AgendaTab,
} from './agenda-model';

const MAX_TIMEOUT_MS = 2_147_483_647;

/** Aísla consulta, caducidad y respuestas tardías de la presentación. */
export function useLearningAgenda(organizationSlug?: string) {
  const [result, setResult] = useState<{
    key: string;
    catalog?: LiveCatalog;
    receivedAt?: number;
    error?: string;
  } | null>(null);
  const [selection, setSelection] = useState<{ tab: AgendaTab; page: number }>({
    tab: 'personal',
    page: 0,
  });
  const [revision, setRevision] = useState(0);
  const { tab, page } = selection;
  const view = tab === 'personal' ? 'student' : 'instructor';
  const requestKey = JSON.stringify([organizationSlug, page, tab, revision]);
  const catalog = result?.key === requestKey ? result.catalog : undefined;
  const error = result?.key === requestKey ? result.error : undefined;
  const loading = Boolean(organizationSlug) && result?.key !== requestKey;
  // Los permisos conservados solo pertenecen a esta instancia, aislada por organización.
  const permissions = agendaPermissions(result?.catalog);
  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => {
    let disposed = false;
    if (!organizationSlug) return;
    void learningLiveService
      .catalog({
        organization_slug: organizationSlug,
        page,
        view,
        ...(tab === 'history' ? { period: 'past' as const } : {}),
      })
      .then((response) => {
        if (disposed) return;
        const nextPermissions = response.success ? agendaPermissions(response.catalog) : null;
        if (
          tab !== 'personal' &&
          ((response.success &&
            (!nextPermissions?.canManage ||
              (tab === 'history' && !nextPermissions?.canViewHistory))) ||
            (!response.success && response.code === 'access_denied'))
        ) {
          setSelection({ tab: 'personal', page: 0 });
          setResult(null);
          return;
        }
        setResult(
          response.success
            ? { key: requestKey, catalog: response.catalog, receivedAt: Date.now() }
            : { key: requestKey, error: response.error },
        );
      })
      .catch(() => {
        if (!disposed) setResult({ key: requestKey, error: 'No se pudieron cargar tus sesiones.' });
      });
    return () => {
      disposed = true;
    };
  }, [organizationSlug, page, view, tab, requestKey]);

  useEffect(() => {
    if (!catalog || tab === 'history') return;
    const deadlines = catalog.sessions.filter((session) => session.status === 'scheduled').map(sessionEnd).filter((deadline) => deadline > Date.now());
    if (!deadlines.length) return;
    // Un vencimiento, sin polling continuo. Al regresar a la ventana se vuelve a validar.
    const timer = window.setTimeout(
      () => setRevision((value) => value + 1),
      Math.min(MAX_TIMEOUT_MS, Math.min(...deadlines) - Date.now() + 100),
    );
    return () => window.clearTimeout(timer);
  }, [catalog, tab]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRevision((value) => value + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return {
    catalog,
    error,
    loading,
    permissions,
    tab,
    page,
    refresh,
    sessions: visibleAgendaSessions(
      catalog?.sessions || [],
      tab === 'history',
      result?.receivedAt ?? 0,
    ),
    selectTab: (next: AgendaTab) => {
      if (
        (next === 'management' && !permissions.canManage) ||
        (next === 'history' && !permissions.canViewHistory)
      )
        return;
      setSelection({ tab: next, page: 0 });
    },
    selectPage: (next: number) =>
      setSelection((current) => ({ ...current, page: Math.max(0, next) })),
  };
}
