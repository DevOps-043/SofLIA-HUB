import type { LiveCatalogSession } from '../../shared/learning-live-catalog';
import { LiveIcon } from './LiveIcon';

const month = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const day = new Intl.DateTimeFormat('es-MX', { day: '2-digit' });
const date = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const time = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' });
const statusLabels = {
  scheduled: 'Programada',
  live: 'En vivo',
  ended: 'Finalizada',
  cancelled: 'Cancelada',
};

export function SessionAgendaCard({
  session,
  featured = false,
  history = false,
  managing = false,
  onSelect,
  onDetails,
}: {
  session: LiveCatalogSession;
  featured?: boolean;
  history?: boolean;
  managing?: boolean;
  onSelect: () => void;
  onDetails?: () => void;
}) {
  const start = new Date(session.starts_at);
  return (
    <article
      className={`agenda-session${featured ? ' agenda-session-featured' : ''}`}
      aria-label={featured ? 'Próxima sesión' : undefined}
    >
      <time className="agenda-date" dateTime={session.starts_at} aria-label={date.format(start)}>
        <span>{month.format(start).replace('.', '')}</span>
        <strong>{day.format(start)}</strong>
      </time>
      <div className="agenda-session-content">
        <div className="agenda-session-eyebrow">
          <span>{session.course_title}</span>
          <span className={`agenda-status is-${session.status}`}>
            <i />
            {history && (session.status === 'scheduled' || session.status === 'live')
              ? 'Sin cierre registrado'
              : statusLabels[session.status]}
          </span>
        </div>
        {featured ? <h2>{session.title}</h2> : <h3>{session.title}</h3>}
        {featured && session.description && (
          <p className="agenda-description">{session.description}</p>
        )}
        <div className="agenda-meta">
          <time dateTime={session.starts_at}>
            {date.format(start)} · {time.format(start)}
          </time>
          <span>{session.duration_minutes} min</span>
          <span className="agenda-teacher">{session.instructor_name}</span>
        </div>
      </div>
      <div className="agenda-session-action">
        {history ? (
          onDetails && (
            <button
              type="button"
              className="agenda-button-secondary"
              onClick={onDetails}
              aria-label={`Ver detalles: ${session.title}`}
            >
              Detalles
              <LiveIcon name="arrow" />
            </button>
          )
        ) : (
          <button
            type="button"
            className={featured ? 'agenda-button-primary' : 'agenda-button-secondary'}
            onClick={onSelect}
            aria-label={
              featured
                ? session.status === 'live'
                  ? 'Unirme a la sesión'
                  : managing
                    ? 'Preparar aula'
                    : 'Ver sesión'
                : `Ver sesión: ${session.title}`
            }
          >
            {session.status === 'live'
              ? 'Entrar al aula'
              : managing
                ? 'Preparar aula'
                : 'Ver sesión'}
            <LiveIcon name="arrow" />
          </button>
        )}
      </div>
    </article>
  );
}
