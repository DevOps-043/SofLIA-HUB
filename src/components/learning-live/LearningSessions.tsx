import { useEffect, useState } from 'react';
import { learningLiveService } from '../../services/learning-live-service';
import type { LiveCatalog, LiveCatalogSession } from '../../shared/learning-live-catalog';
import type { LearningLiveSessionReference } from '../../shared/learning-live-session';
import { LiveIcon } from './LiveIcon';
import './learning-live.css';

const date = (value: string) => new Date(value).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const time = (value: string) => new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export function LearningSessions({ organizationSlug, organizationName, onSelect, onClose }: {
  organizationSlug?: string; organizationName?: string; onSelect: (reference: LearningLiveSessionReference) => void; onClose: () => void;
}) {
  const [result, setResult] = useState<{ key: string; catalog?: LiveCatalog; error?: string } | null>(null);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'student' | 'instructor'>('student');
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([organizationSlug, page, view, revision]);
  const catalog = result?.key === requestKey ? result.catalog : undefined;
  const error = result?.key === requestKey ? result.error : undefined;
  const loading = !!organizationSlug && result?.key !== requestKey;
  useEffect(() => {
    let disposed = false;
    if (!organizationSlug) return;
    void learningLiveService.catalog({ organization_slug: organizationSlug, page, view }).then((response) => {
      if (disposed) return;
      setResult(response.success ? { key: requestKey, catalog: response.catalog } : { key: requestKey, error: response.error });
    }).catch(() => { if (!disposed) setResult({ key: requestKey, error: 'No se pudieron cargar tus sesiones.' }); });
    return () => { disposed = true; };
  }, [organizationSlug, page, view, requestKey]);
  const sessions = [...(catalog?.sessions || [])].sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live') || a.starts_at.localeCompare(b.starts_at));
  const featured = page === 0 ? sessions[0] : undefined;
  const select = (session: LiveCatalogSession) => { if (organizationSlug) onSelect({ organization_slug: organizationSlug, session_id: session.id }); };
  return <main className="live-agenda" aria-labelledby="live-agenda-title">
    <div className="live-agenda-inner">
      <header className="live-agenda-top"><span className="live-brand"><LiveIcon name="book" /> SofLIA Learning <span>/</span> {organizationName || 'Tu espacio de aprendizaje'}</span><button className="live-icon-button" aria-label="Cerrar sesiones síncronas" onClick={onClose}><LiveIcon name="close" /></button></header>
      <div className="live-agenda-heading"><div><span className="live-eyebrow">APRENDE EN COMPAÑÍA</span><h1 id="live-agenda-title">Sesiones síncronas<span>.</span></h1><p>Tu próxima conversación, idea o descubrimiento empieza aquí.</p></div><button className="live-secondary" disabled={loading || !organizationSlug} onClick={() => setRevision((value) => value + 1)}><LiveIcon name="refresh" />Actualizar</button></div>
      <div className="live-agenda-toolbar"><span><LiveIcon name="calendar" /> Tu agenda <span className="live-count">{catalog?.total ?? '—'}</span></span><span className="live-muted">Horario local · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div>
      {(catalog?.can_teach || view === 'instructor') && <div className="live-segment" aria-label="Tipo de agenda"><button aria-pressed={view === 'student'} onClick={() => { setView('student'); setPage(0); }}>Mis cursos</button><button aria-pressed={view === 'instructor'} onClick={() => { setView('instructor'); setPage(0); }}>Clases que imparto</button></div>}
      {loading && <div className="live-loading" role="status"><div className="live-skeleton" /><p>Buscando tus próximas sesiones…</p></div>}
      {error && <div className="live-empty" role="alert"><LiveIcon name="calendar" /><h2>No pudimos cargar tu agenda</h2><p>{error}</p><button className="live-primary" onClick={() => setRevision((value) => value + 1)}>Reintentar</button></div>}
      {!loading && !error && !sessions.length && <div className="live-empty"><div className="live-empty-icon"><LiveIcon name="calendar" /></div><h2>{organizationSlug ? 'Tu agenda está despejada' : 'Elige tu organización'}</h2><p>{organizationSlug ? 'Cuando se programe una sesión para tus cursos, aparecerá aquí.' : 'Selecciona una organización desde tu perfil para consultar tus clases.'}</p>{page > 0 && <button onClick={() => setPage(0)}>Volver al inicio</button>}</div>}
      {featured && <section className="live-featured" aria-label="Sesión destacada"><div className="live-featured-main"><span className={`live-status ${featured.status === 'live' ? 'is-live' : ''}`}><i />{featured.status === 'live' ? 'En vivo ahora' : 'Tu próxima sesión'}</span><p className="live-course">{featured.course_title}</p><h2>{featured.title}</h2>{featured.description && <p className="live-description">{featured.description}</p>}<div className="live-session-meta"><span><LiveIcon name="calendar" />{date(featured.starts_at)}</span><span><LiveIcon name="clock" />{time(featured.starts_at)} · {featured.duration_minutes} min</span></div><div className="live-featured-footer"><span className="live-instructor"><span className="live-avatar">{featured.instructor_name.slice(0, 1)}</span><span><small>Tu instructor</small>{featured.instructor_name}</span></span><button className="live-primary" onClick={() => select(featured)}>{featured.status === 'live' ? 'Unirme a la sesión' : 'Ver sesión'}<LiveIcon name="arrow" /></button></div></div><div className="live-featured-art" aria-hidden="true"><div className="live-orbit orbit-one" /><div className="live-orbit orbit-two" /><div className="live-orbit orbit-three" /><div className="live-video-emblem"><LiveIcon name="video" /></div><span>Un espacio para aprender juntos</span></div></section>}
      {sessions.length > (featured ? 1 : 0) && <section className="live-upcoming" aria-label="Próximas sesiones"><div className="live-section-heading"><h2>En tu agenda</h2><span className="live-muted">{catalog?.total} sesiones programadas</span></div>{sessions.filter((session) => session.id !== featured?.id).map((session) => <article className="live-session-row" key={session.id}><div className="live-date-tile"><span>{new Date(session.starts_at).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}</span><strong>{new Date(session.starts_at).getDate()}</strong></div><div className="live-row-details"><span className="live-course">{session.course_title}</span><h3>{session.title}</h3><p>{time(session.starts_at)} · {session.duration_minutes} min <span>· {session.instructor_name}</span></p></div><span className="live-status"><i />{session.status === 'live' ? 'En vivo' : 'Programada'}</span><button className="live-secondary" onClick={() => select(session)} aria-label={`Ver sesión: ${session.title}`}>Ver sesión<LiveIcon name="arrow" /></button></article>)}</section>}
      {!!catalog && catalog.total > 20 && <nav className="live-pagination" aria-label="Páginas de sesiones"><button disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil(catalog.total / 20)}</span><button disabled={(page + 1) * 20 >= catalog.total || loading} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}
      <footer className="live-agenda-footer"><LiveIcon name="video" /><p>Tu clase y tu espacio de colaboración, juntos en SofLIA Hub.</p><span>Conecta. Participa. Aprende.</span></footer>
    </div>
  </main>;
}
