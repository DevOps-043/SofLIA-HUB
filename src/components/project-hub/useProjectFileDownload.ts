import { useEffect, useRef, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';

export function useProjectFileDownload(workspaceId: string, projectId: string) {
  const key = `${workspaceId}/${projectId}`;
  const active = useRef<{ id: string; key: string } | null>(null);
  const [state, setState] = useState<{ key: string; running: boolean; message: string } | null>(null);
  useEffect(() => () => {
    const pending = active.current;
    if (pending) { active.current = null; void projectHubApi.cancelDownload(pending.id).catch(() => {}); }
  }, [key]);
  const download = async (evidenceId: string) => {
    if (active.current) return;
    const operation = { id: crypto.randomUUID(), key }; active.current = operation;
    setState({ key, running: true, message: 'Revisa el archivo y elige dónde guardar una copia nueva.' });
    try {
      const result = await projectHubApi.downloadFile(workspaceId, projectId, evidenceId, operation.id);
      if (active.current !== operation) return;
      const message = result.data?.saved ? (result.success ? 'Copia guardada y verificada.' : 'La copia se guardó antes de cancelar o cambiar el contexto. Comprueba el destino elegido.')
        : result.uncertain ? 'No se confirmó la publicación de la copia. Comprueba el destino elegido antes de repetir.'
          : result.cancelled ? 'Descarga cancelada. No se guardó una copia.' : result.error || 'No se pudo guardar la copia.';
      setState({ key, running: false, message });
    } catch {
      if (active.current === operation) setState({ key, running: false, message: 'No se confirmó el resultado. Comprueba el destino elegido antes de repetir.' });
    } finally { if (active.current === operation) active.current = null; }
  };
  const cancel = async () => {
    const operation = active.current; if (operation?.key !== key) return;
    try {
      const result = await projectHubApi.cancelDownload(operation.id);
      if (active.current === operation) setState(previous => previous && { ...previous,
        message: result.success ? 'Cancelación solicitada. Cierra el selector si sigue abierto.' : 'No se confirmó la cancelación.' });
    } catch { /* El resultado original determina si llegó a publicarse una copia. */ }
  };
  return { download, cancel, busy: state?.key === key && state.running, message: state?.key === key ? state.message : '' };
}
