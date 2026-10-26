import { useCallback, useEffect, useRef, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';
import type { ProjectLocationFiles } from '../../shared/project-creation';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function ProjectStorageFiles({ workspaceId, projectId, canWrite, onOpenWeb }: { workspaceId: string; projectId: string; canWrite: boolean; onOpenWeb?: (url: string) => void }) {
  const [data, setData] = useState<ProjectLocationFiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const active = useRef<string | null>(null);
  const load = useCallback(async () => {
    const request = ++generation.current; setLoading(true);
    try {
      const result = await projectHubApi.locationFiles({ workspaceId, projectId });
      if (request !== generation.current) return;
      if (result.success && result.data) setData(result.data);
      else setMessage(result.error || 'No se pudo consultar la ubicación de archivos.');
    } catch { if (request === generation.current) setMessage('No se pudo consultar la ubicación de archivos.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [workspaceId, projectId]);
  const invalidate = useCallback(() => { generation.current++; const id = active.current; active.current = null; if (id) void projectHubApi.cancelLocationUpload(id).catch(() => {}); }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => { window.clearTimeout(timer); invalidate(); }; }, [load, invalidate]);
  const upload = async () => {
    if (active.current) return;
    const id = crypto.randomUUID(); active.current = id; setBusy(true); setMessage('Selecciona los archivos para guardarlos en el destino del proyecto.');
    try {
      const result = await projectHubApi.uploadLocationFiles({ workspaceId, projectId, operationId: id });
      if (active.current !== id) return;
      setMessage(result.success ? `${result.data?.uploaded ?? 0} archivo(s) guardado(s) en su ubicación.` : (result.error || (result.cancelled ? 'Selección cancelada.' : 'No se pudo guardar la selección.')) + (result.recoveryRequired || result.uncertain ? ' Revisa el destino antes de repetir.' : ''));
      await load();
    } catch { if (active.current === id) setMessage('No se pudo verificar el resultado. Revisa la carpeta antes de repetir.'); }
    finally { if (active.current === id) { active.current = null; setBusy(false); } }
  };
  const location = data?.location;
  return <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Archivos en {location?.mode === 'google_drive' ? 'Google Drive' : location?.mode === 'onedrive' ? 'OneDrive' : 'la carpeta del proyecto'}</h2><p className="mt-1 break-all text-xs text-secondary">{location?.cloud ? `${location.cloud.accountEmail} · ${location.cloud.name}` : location?.rootPath}</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="ghost" disabled={busy || loading} onClick={() => { setMessage(''); void load(); }}>Actualizar archivos</Button>{canWrite && location && location.mode !== 'cloud' && <Button type="button" size="sm" disabled={busy || loading} onClick={() => void upload()}>Añadir archivos</Button>}</div></div>
    {loading ? <p className="mt-4 text-sm text-secondary" role="status">Consultando archivos…</p> : !location || location.mode === 'cloud' ? <p className="mt-4 text-sm text-secondary">Este proyecto anterior no tiene una carpeta local, de Drive o de OneDrive configurada.</p> : data?.files.length ? <ul className="mt-4 divide-y divide-border">{data.files.map(file => <li key={file.id} className="flex items-center gap-3 py-3 text-sm"><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-xs text-secondary">{Math.ceil(file.size / 1024)} KB</span>{file.webUrl && onOpenWeb && <Button type="button" variant="ghost" size="sm" onClick={() => onOpenWeb(file.webUrl!)}>Abrir</Button>}</li>)}</ul> : <p className="mt-4 text-sm text-secondary">Aún no hay archivos en esta ubicación.</p>}
    {data?.partial && <p className="mt-3 text-xs text-secondary">Vista parcial de la carpeta. Consulta el resto directamente en su ubicación.</p>}
    {location?.cloud?.webUrl && onOpenWeb && <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => onOpenWeb(location.cloud!.webUrl!)}>Abrir carpeta en {location.mode === 'google_drive' ? 'Drive' : 'OneDrive'}</Button>}
    {message && <p role="status" className="mt-3 text-xs text-secondary">{message}</p>}
    {busy && <Button type="button" size="sm" variant="ghost" onClick={() => { if (active.current) void projectHubApi.cancelLocationUpload(active.current); }}>Cancelar operación</Button>}
  </Card>;
}
