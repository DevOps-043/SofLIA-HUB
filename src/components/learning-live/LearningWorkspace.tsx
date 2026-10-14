import type { LearningLiveSessionReference } from '../../shared/learning-live-session';
import { LiveIcon } from './LiveIcon';
import { ConnectedStudio } from './ConnectedStudio';
import './learning-workspace.css';

/** El snapshot del estudio confirma el rol; la navegación no concede permisos. */
export function LearningWorkspace({ reference, onClose, onBackToSessions }: {
  reference?: LearningLiveSessionReference;
  onClose: () => void;
  onBackToSessions: () => void;
}) {
  if (reference) return <ConnectedStudio key={`${reference.organization_slug}:${reference.session_id}`} reference={reference} onBack={onBackToSessions} onClose={onClose} />;
  return <section className="learning-workspace" aria-label="Aula SofLIA">
    <header className="learning-workspace-toolbar">
      <button type="button" aria-label="Volver a mis sesiones" onClick={onBackToSessions}><LiveIcon name="back" /></button>
      <button type="button" aria-label="Cerrar aula" onClick={onClose}><LiveIcon name="close" /></button>
    </header>
    <div className="learning-workspace-canvas" role="region" aria-label="Espacio de la sesión" />
  </section>;
}
