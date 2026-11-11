import { useEffect, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';
import type { ProjectLocation } from '../../shared/project-creation';
import { Card } from '../ui/Card';

export function ProjectLocationCard({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const [location, setLocation] = useState<ProjectLocation | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void projectHubApi.getLocation({ workspaceId, projectId }).then(result => {
      if (!active) return;
      if (result.success) setLocation(result.data ?? null);
      else setError('No se pudo consultar la ubicación guardada en este equipo.');
    }).catch(() => { if (active) setError('No se pudo consultar la ubicación guardada en este equipo.'); });
    return () => { active = false; };
  }, [workspaceId, projectId]);
  if (!location && !error) return null;
  return <Card><h2 className="text-sm font-semibold">Ubicación del proyecto</h2>{error ? <p className="mt-2 text-xs text-secondary">{error}</p> : location && <>
    <p className="mt-2 text-sm font-medium">{location.mode === 'local' ? 'En este equipo' : location.mode === 'google_drive' ? 'Google Drive' : location.mode === 'onedrive' ? 'OneDrive' : 'Ubicación sin configurar'}</p>
    <p className="mt-1 break-all text-xs text-secondary">{location.rootPath || (location.cloud ? `${location.cloud.accountEmail} · ${location.cloud.name}` : 'Este proyecto anterior no tiene una carpeta de Drive o OneDrive vinculada.')}</p>
    {!!location.additionalFolders.length && <div className="mt-4 border-t border-border pt-3"><h3 className="text-xs font-semibold">Carpetas adicionales de este equipo</h3><ul className="mt-2 space-y-2">{location.additionalFolders.map(folder => <li key={folder} className="break-all text-xs text-secondary">{folder}</li>)}</ul></div>}
    {location.mode === 'local' && <p className="mt-3 text-xs text-secondary">Los archivos permanecen en tu carpeta local. Las carpetas adicionales conservan su ubicación original.</p>}
  </>}</Card>;
}
