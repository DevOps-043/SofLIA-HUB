import { useEffect, useState } from 'react';
import type { LearningLiveSessionReference } from '../../shared/learning-live-session';
import { learningLiveService } from '../../services/learning-live-service';
import { LiveIcon } from './LiveIcon';
import { InstructorStudio } from './instructor/InstructorStudio';
import './learning-workspace.css';

/** Learning confirma el rol de la sesión; el prototipo no concede permisos. */
export function LearningWorkspace({ reference, onClose, onBackToSessions }: {
  reference?: LearningLiveSessionReference;
  onClose: () => void;
  onBackToSessions: () => void;
}) {
  const [access, setAccess] = useState<{ key: string; canManage: boolean; title?: string; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const slug = reference?.organization_slug, sessionId = reference?.session_id;
  const key = `${slug}:${sessionId}:${revision}`;
  useEffect(() => {
    if (!slug || !sessionId) return;
    let disposed = false;
    void learningLiveService.workspace({ organization_slug: slug, session_id: sessionId }, { type: 'snapshot' }).then((result) => {
      if (disposed) return;
      if (result.success && result.snapshot) setAccess({ key, canManage: result.snapshot.can_manage, title: result.snapshot.session.title });
      else setAccess({ key, canManage: false, error: result.success ? 'Learning no devolvió el acceso de esta sesión.' : result.error });
    }).catch(() => { if (!disposed) setAccess({ key, canManage: false, error: 'No pudimos verificar tu acceso al aula.' }); });
    return () => { disposed = true; };
  }, [slug, sessionId, key]);
  const current = access?.key === key ? access : null;
  if (current?.canManage) return <InstructorStudio title={current.title} onBack={onBackToSessions} onClose={onClose} />;
  return <section className="learning-workspace" aria-label="Aula SofLIA">
    <header className="learning-workspace-toolbar">
      <button type="button" aria-label="Volver a mis sesiones" onClick={onBackToSessions}><LiveIcon name="back" /></button>
      <button type="button" aria-label="Cerrar aula" onClick={onClose}><LiveIcon name="close" /></button>
    </header>
    <div className="learning-workspace-canvas" role="region" aria-label="Espacio de la sesión">
      {reference && !current && <p className="learning-workspace-status" role="status">Verificando acceso a la sesión…</p>}
      {current?.error && <div className="learning-workspace-status" role="alert"><p>{current.error}</p><button onClick={() => setRevision((value) => value + 1)}>Reintentar</button></div>}
    </div>
  </section>;
}
