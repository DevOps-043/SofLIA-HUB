import { useCallback, useEffect, useRef, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';
import type { ProjectLocationFiles } from '../../shared/project-creation';

export function useProjectStorage(workspaceId: string, projectId: string) {
  const [data, setData] = useState<ProjectLocationFiles | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const generation = useRef(0), active = useRef<string | null>(null), live = useRef(true);
  const load = useCallback(async () => {
    const request = ++generation.current; setLoading(true);
    try {
      const result = await projectHubApi.locationFiles({ workspaceId, projectId });
      if (!live.current || request !== generation.current) return;
      if (result.success && result.data) setData(result.data); else setMessage(result.error || 'No se pudo consultar la carpeta del proyecto.');
    } catch { if (live.current && request === generation.current) setMessage('No se pudo consultar la carpeta del proyecto.'); }
    finally { if (live.current && request === generation.current) setLoading(false); }
  }, [workspaceId, projectId]);
  useEffect(() => { const sequence = generation; live.current = true; const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); live.current = false; sequence.current++; const id = active.current; active.current = null; if (id) void projectHubApi.cancelLocationUpload(id).catch(() => {}); }; }, [load]);
  const upload = async () => {
    if (active.current) return; const id = crypto.randomUUID(); active.current = id; setBusy(true); setMessage('Selecciona los archivos para este proyecto.');
    try {
      const result = await projectHubApi.uploadLocationFiles({ workspaceId, projectId, operationId: id });
      if (!live.current || active.current !== id) return;
      setMessage(result.success ? `${result.data?.uploaded ?? 0} archivo(s) añadido(s).` : `${result.error || (result.cancelled ? 'Selección cancelada.' : 'No se pudo completar la selección.')}${result.uncertain || result.recoveryRequired ? ' Revisa el destino antes de repetir.' : ''}`);
      await load();
    } catch { if (live.current && active.current === id) setMessage('No se confirmó la operación. Revisa el destino antes de repetir.'); }
    finally { if (live.current && active.current === id) { active.current = null; setBusy(false); } }
  };
  return { data, loading, busy, message, load, upload, cancel: () => active.current ? projectHubApi.cancelLocationUpload(active.current) : Promise.resolve() };
}
