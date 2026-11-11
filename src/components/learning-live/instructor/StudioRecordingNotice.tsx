import { useId } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioDialog } from './StudioDialog';
import './studio-recording-notice.css';

interface StudioRecordingNoticeProps {
  onClose: () => void;
  onAccept: () => void;
}

export function StudioRecordingNotice({ onClose, onAccept }: StudioRecordingNoticeProps) {
  const descriptionId = useId();

  return <StudioDialog
    title="Aviso de privacidad de la grabación"
    className="studio-recording-notice"
    closeLabel="Cerrar aviso de grabación"
    descriptionId={descriptionId}
    icon="shield"
    onClose={onClose}
  >
    <div className="studio-recording-notice__body">
      <p className="studio-recording-notice__intro" id={descriptionId}>
        Al conectarte como instructor, la sesión comenzará a grabarse automáticamente en la nube.
      </p>
      <ul className="studio-recording-notice__details">
        <li>
          <span className="studio-recording-notice__detail-icon"><LiveIcon name="video" /></span>
          <div>
            <h3>Qué puede incluir la grabación</h3>
            <p>El audio, el video y el contenido que se comparta en la sesión, como la pantalla o una presentación.</p>
          </div>
        </li>
        <li>
          <span className="studio-recording-notice__detail-icon"><LiveIcon name="lock" /></span>
          <div>
            <h3>Quién puede ver la repetición</h3>
            <p>La grabación se guarda en privado. Si la repetición se publica en Learning, solo podrán verla los participantes autorizados.</p>
          </div>
        </li>
      </ul>
    </div>
    <footer className="studio-recording-notice__footer">
      <p>Puedes cancelar y seguir preparando la sesión en el estudio. Al aceptar, Hub solicitará la conexión de audio y video.</p>
      <div className="studio-recording-notice__actions">
        <button type="button" className="studio-recording-notice__cancel" autoFocus onClick={onClose}>Cancelar</button>
        <button type="button" className="studio-primary-button" onClick={onAccept}>
          Aceptar y conectar <LiveIcon name="arrow" />
        </button>
      </div>
    </footer>
  </StudioDialog>;
}
