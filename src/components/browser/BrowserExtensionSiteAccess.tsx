import { useEffect, useRef, useState } from 'react';
import { integratedBrowserService, type BrowserExtensionMetadata } from '../../services/integrated-browser-service';

export function BrowserExtensionSiteAccess({ extension, onApplied }: {
  extension: BrowserExtensionMetadata;
  onApplied: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [sites, setSites] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = useRef(true);
  useEffect(() => { current.current = true; return () => { current.current = false; }; }, []);
  const apply = async () => {
    setBusy(true); setError('');
    try {
      const response = await integratedBrowserService.restrictExtensionSites(extension.installId, sites.split(/\r?\n/).map(site => site.trim()).filter(Boolean));
      if (!current.current) return;
      if (!response.success) { setError(response.error || 'No se pudieron restringir los sitios.'); return; }
      setEditing(false); await onApplied();
    } catch {
      if (current.current) setError('No se pudieron restringir los sitios. Actualiza la lista antes de reintentar.');
    } finally { if (current.current) setBusy(false); }
  };
  return <div className="mt-3 border-t border-border pt-3 text-[11px] text-secondary">
    {!editing ? <button type="button" className="soflia-browser-button soflia-browser-button--secondary"
      disabled={extension.enabled} onClick={() => { setSites((extension.siteAccess ?? []).join('\n')); setEditing(true); setError(''); }}>
      Restringir sitios
    </button> : <>
      <p>Deshabilita la extensión y cierra las otras pestañas y ventanas separadas. Navega a about:blank en la última pestaña. Sólo se reducen permisos: recuperar un sitio retirado requiere reinstalar y revisar la carpeta original.</p>
      <p className="mt-2">Hasta 50 sitios, uno por línea (por ejemplo https://ejemplo.com). Cada selección incluye todos los puertos de ese dominio y protocolo, sin subdominios. Vacío retira todos los permisos declarados de acceso a páginas. Sólo admite extensiones compatibles con storage/scripting; no es un cortafuegos de red.</p>
      <label className="mt-2 block">Sitios permitidos como límite máximo
        <textarea aria-label="Sitios permitidos como límite máximo" disabled={busy} value={sites} maxLength={16000}
          onChange={event => setSites(event.target.value)} rows={4} className="mt-1 w-full rounded border border-border bg-card p-2 text-primary" />
      </label>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy || extension.enabled} className="soflia-browser-button soflia-browser-button--primary" onClick={() => void apply()}>{busy ? 'Aplicando…' : 'Aplicar restricción'}</button>
        <button type="button" disabled={busy} className="soflia-browser-button soflia-browser-button--secondary" onClick={() => setEditing(false)}>Cancelar</button>
      </div>
    </>}
    {extension.enabled && <p className="mt-1">Deshabilita la extensión para restringir sus sitios.</p>}
    {extension.siteAccess && <p className="mt-1">Límite configurado: {extension.siteAccess.join(', ') || 'sin sitios'}. Los permisos efectivos son los declarados arriba.</p>}
    {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
  </div>;
}
