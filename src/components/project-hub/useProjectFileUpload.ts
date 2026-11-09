import { useEffect, useRef, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';

export function useProjectFileUpload(workspaceId: string, projectId: string) {
  const key = `${workspaceId}/${projectId}`;
  const active = useRef<{ id: string; key: string } | null>(null);
  const [state, setState] = useState<{ key: string; running: boolean; message: string; revision: number } | null>(null);
  useEffect(() => () => {
    const pending = active.current;
    if (pending) { active.current = null; void projectHubApi.cancelUpload(pending.id).catch(() => {}); }
  }, [key]);
  const upload = async () => {
    if (active.current) return;
    const operation = { id: crypto.randomUUID(), key }; active.current = operation;
    setState({ key, running: true, message: 'Selecciona y revisa los archivos en el diálogo de la aplicación.', revision: 0 });
    try {
      const result = await projectHubApi.uploadFiles(workspaceId, projectId, operation.id);
      if (active.current !== operation) return;
      const uploaded = result.data?.uploaded ?? 0;
      const message = result.success ? `${uploaded} archivo(s) confirmado(s) en el proyecto.`
        : `${result.cancelled ? 'Subida cancelada.' : result.error || 'No se completó la subida.'} ${uploaded} archivo(s) confirmado(s).`
          + (result.recoveryRequired || result.uncertain ? ' Revisa los pendientes en el proyecto antes de repetir; puede haber efectos sin confirmar.' : '');
      setState({ key, running: false, message, revision: uploaded });
    } catch {
      if (active.current === operation) setState({ key, running: false, revision: 0,
        message: 'No se confirmó la subida. Revisa el proyecto antes de volver a intentarlo.' });
    } finally { if (active.current === operation) active.current = null; }
  };
  const cancel = async () => {
    const operation = active.current;
    if (operation?.key === key) {
      try {
        const result = await projectHubApi.cancelUpload(operation.id);
        if (active.current === operation) setState(previous => previous && { ...previous,
          message: result.success ? 'Cancelación solicitada. Si el selector sigue abierto, ciérralo para terminar.' : 'No se confirmó la cancelación. Revisa la operación en curso.' });
      } catch { /* El resultado de la operación original conserva la incertidumbre. */ }
    }
  };
  return { upload, cancel, busy: state?.key === key && state.running, message: state?.key === key ? state.message : '', revision: state?.key === key ? state.revision : 0 };
}
