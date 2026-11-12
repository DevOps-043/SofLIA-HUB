import { useState } from 'react';
import { LIVE_CATALOG_PAGE_SIZE } from '../../shared/learning-live-catalog';
import type { LearningLiveSessionReference } from '../../shared/learning-live-session';
import { LiveIcon } from './LiveIcon';
import { SessionAgendaCard } from './SessionAgendaCard';
import { managementPageUrl } from './agenda-model';
import { useLearningAgenda } from './useLearningAgenda';
import './learning-live.css';

type LearningSessionsProps = {
  organizationSlug?: string;
  organizationName?: string;
  onSelect: (reference: LearningLiveSessionReference) => void;
  onClose: () => void;
  onOpenManagement?: (url: string) => Promise<void>;
};

/** Cambiar organización también reinicia página, vista y permisos retenidos. */
export function LearningSessions(props: LearningSessionsProps) {
  return <OrganizationAgenda key={props.organizationSlug ? `org:${props.organizationSlug}` : 'none'} {...props} />;
}

function OrganizationAgenda({
  organizationSlug,
  organizationName,
  onSelect,
  onClose,
  onOpenManagement,
}: LearningSessionsProps) {
  const agenda = useLearningAgenda(organizationSlug);
  const [opening, setOpening] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const { catalog, loading, error, sessions, tab, page, permissions } = agenda;
  const history = tab === 'history';
  const managing = tab !== 'personal';
  const featured = !history && page === 0 ? sessions[0] : undefined;
  const remaining = sessions.filter((session) => session.id !== featured?.id);
  const managementUrl = managementPageUrl(catalog, organizationSlug);
  const roleLabels = {
    platform_admin: 'Administración de plataforma',
    organization_admin: 'Administración de organización',
    instructor: 'Instructor',
    student: 'Mi aprendizaje',
  };
  const admin = permissions.role === 'platform_admin' || permissions.role === 'organization_admin';
  // Una respuesta antigua puede incluir vencidas; no inventar un total global corregido.
  const total = catalog && sessions.length === catalog.sessions.length ? catalog.total : undefined;
  const pages = Math.ceil((catalog?.total || 0) / LIVE_CATALOG_PAGE_SIZE);
  const selectSession = (id: string) => {
    if (organizationSlug) onSelect({ organization_slug: organizationSlug, session_id: id });
  };
  const openManagement = async (url: string) => {
    if (!onOpenManagement || opening) return;
    setOpening(true);
    setNavigationError(null);
    try {
      await onOpenManagement(url);
    } catch {
      setNavigationError('No se pudo abrir Learning. Intenta de nuevo.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <main className="live-agenda" aria-labelledby="live-agenda-title">
      <div className="live-agenda-inner">
        <header className="agenda-topbar">
          <div className="agenda-breadcrumb">
            <LiveIcon name="book" />
            <span>Learning</span>
            <span aria-hidden="true">/</span>
            <strong>{organizationName || 'Tu organización'}</strong>
          </div>
          <button
            type="button"
            className="agenda-icon-button"
            aria-label="Cerrar sesiones síncronas"
            onClick={onClose}
          >
            <LiveIcon name="close" />
          </button>
        </header>
        <div className="agenda-heading">
          <div>
            <span className="agenda-eyebrow">
              {permissions.role
                ? roleLabels[permissions.role]
                : permissions.canManage
                  ? 'Gestión de sesiones'
                  : 'Mi aprendizaje'}
            </span>
            <h1 id="live-agenda-title">Sesiones</h1>
            <p>
              {permissions.canManage
                ? 'Tu agenda, tus clases y su seguimiento, en un solo lugar.'
                : 'Un espacio para tus próximas clases y conversaciones.'}
            </p>
          </div>
          <div className="agenda-heading-actions">
            <button
              type="button"
              className="agenda-button-secondary"
              disabled={loading || !organizationSlug}
              onClick={agenda.refresh}
              aria-label="Actualizar sesiones"
            >
              <LiveIcon name="refresh" />
              <span>Actualizar</span>
            </button>
            {managementUrl && onOpenManagement && (
              <button
                type="button"
                className="agenda-button-primary"
                disabled={opening}
                onClick={() => void openManagement(managementUrl)}
              >
                Gestionar en Learning
                <LiveIcon name="arrow" />
              </button>
            )}
          </div>
        </div>
        <nav className="agenda-navigation" aria-label="Vista de sesiones">
          <div className="agenda-tabs">
            <button
              type="button"
              aria-pressed={tab === 'personal'}
              onClick={() => agenda.selectTab('personal')}
            >
              Mi agenda
            </button>
            {permissions.canManage && (
              <button
                type="button"
                aria-pressed={tab === 'management'}
                onClick={() => agenda.selectTab('management')}
              >
                {admin ? 'Organización' : 'Clases que imparto'}
              </button>
            )}
            {permissions.canViewHistory && (
              <button
                type="button"
                aria-pressed={history}
                onClick={() => agenda.selectTab('history')}
              >
                Historial
              </button>
            )}
          </div>
          <span className="agenda-timezone">
            <LiveIcon name="clock" />
            {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')}
          </span>
        </nav>
        {navigationError && (
          <p className="agenda-notice" role="alert">
            {navigationError}
          </p>
        )}
        <section
          className="agenda-results"
          aria-label={history ? 'Historial de sesiones' : 'Próximas sesiones'}
          aria-busy={loading}
        >
          <div className="agenda-section-heading">
            <h2>
              {history
                ? 'Historial'
                : managing
                  ? admin
                    ? 'Próximas en tu organización'
                    : 'Tus próximas clases'
                  : 'Próximas sesiones'}
            </h2>
            {total !== undefined && (
              <span>
                {total} {total === 1 ? 'sesión' : 'sesiones'}
              </span>
            )}
          </div>
          {loading && (
            <div className="agenda-loading" role="status">
              <span className="sr-only">Buscando tus próximas sesiones…</span>
              {[0, 1, 2].map((row) => (
                <div className="agenda-skeleton" key={row}>
                  <i />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="agenda-empty" role="alert">
              <LiveIcon name="calendar" />
              <h2>No pudimos cargar tu agenda</h2>
              <p>{error}</p>
              <button type="button" className="agenda-button-secondary" onClick={agenda.refresh}>
                Reintentar
              </button>
            </div>
          )}
          {!loading && !error && !sessions.length && (
            <div className="agenda-empty">
              <div className="agenda-empty-icon">
                <LiveIcon name="calendar" />
              </div>
              <h2>
                {!organizationSlug
                  ? 'Elige tu organización'
                  : history
                    ? 'Aún no hay historial'
                    : 'Tu agenda está despejada'}
              </h2>
              <p>
                {!organizationSlug
                  ? 'Selecciona una organización desde tu perfil para consultar tus clases.'
                  : history
                    ? 'Aquí encontrarás las sesiones anteriores que puedes gestionar.'
                    : managing
                      ? 'Las próximas sesiones que puedes gestionar aparecerán aquí.'
                      : 'Cuando se programe una sesión para tus cursos, aparecerá aquí.'}
              </p>
              {page > 0 && (
                <button
                  type="button"
                  className="agenda-button-secondary"
                  onClick={() => agenda.selectPage(0)}
                >
                  Volver al inicio
                </button>
              )}
            </div>
          )}
          {featured && (
            <SessionAgendaCard
              session={featured}
              featured
              managing={managing}
              onSelect={() => selectSession(featured.id)}
            />
          )}
          {remaining.length > 0 && (
            <div className="agenda-list">
              {featured && <h2 className="agenda-list-label">Después en tu agenda</h2>}
              <ul>
                {remaining.map((session) => {
                  const detailsUrl = history
                    ? managementPageUrl(catalog, organizationSlug, session.id)
                    : null;
                  return (
                    <li key={session.id}>
                      <SessionAgendaCard
                        session={session}
                        history={history}
                        managing={managing}
                        onSelect={() => selectSession(session.id)}
                        onDetails={
                          detailsUrl && onOpenManagement
                            ? () => void openManagement(detailsUrl)
                            : undefined
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
        {!!catalog && pages > 1 && (
          <nav className="agenda-pagination" aria-label="Páginas de sesiones">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => agenda.selectPage(page - 1)}
            >
              <LiveIcon name="back" />
              Anterior
            </button>
            <span>
              Página {page + 1} de {pages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= pages || loading}
              onClick={() => agenda.selectPage(page + 1)}
            >
              Siguiente
              <LiveIcon name="arrow" />
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
