import { useEffect, useRef, useState } from 'react';
import { integratedBrowserService, type BrowserExtensionInstallPreview, type BrowserExtensionMetadata } from '../../services/integrated-browser-service';
import type { BrowserExtensionCatalogEntry } from '../../shared/browser-extension-catalog';

export function BrowserExtensionCatalog({ extensions, onPreview }: {
  extensions: BrowserExtensionMetadata[]; onPreview: (preview: BrowserExtensionInstallPreview) => void;
}) {
  const [entries, setEntries] = useState<BrowserExtensionCatalogEntry[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const current = useRef(true);
  useEffect(() => {
    current.current = true;
    void integratedBrowserService.extensionCatalog({ action: 'list' }).then(result => {
      if (!current.current) return;
      if (result.success) setEntries(result.catalog ?? []); else setError(result.error || 'Catálogo no disponible.');
    }).catch(() => { if (current.current) setError('Catálogo no disponible.'); });
    return () => { current.current = false; };
  }, []);
  const review = async (entry: BrowserExtensionCatalogEntry, installed?: BrowserExtensionMetadata) => {
    setBusy(true); setError('');
    try {
      const result = await integratedBrowserService.extensionCatalog({ action: 'prepare', catalogId: entry.id,
        ...(installed ? { updateInstallId: installed.installId } : {}) });
      if (!current.current) return;
      if (!result.success) setError(result.error || 'No se pudo verificar la carpeta.');
      else if (result.preview) onPreview(result.preview);
    } catch { if (current.current) setError('No se pudo verificar la carpeta.'); }
    finally { if (current.current) setBusy(false); }
  };
  return <section className="mb-4 rounded-2xl border border-border p-3 text-[11px] text-secondary" aria-label="Catálogo de extensiones verificadas">
    <h3 className="font-semibold text-primary">Catálogo verificado</h3>
    <p>Versiones fijadas y verificadas por huella contra la fuente oficial. Descarga la revisión indicada por tu cuenta y selecciona sólo su carpeta. No hay descargas ni actualizaciones automáticas.</p>
    {entries.map(entry => {
      const installed = extensions.find(extension => extension.catalogId === entry.id);
      return <div key={entry.id} className="mt-3 border-t border-border pt-2">
        <p className="font-semibold text-primary">{entry.name} · {entry.version}</p>
        <p>{entry.publisher}. {entry.description}</p>
        <label className="mt-1 block">Fuente y revisión autorizadas
          <input className="block w-full rounded border border-border bg-card p-1" readOnly value={entry.sourceUrl} aria-label="Fuente oficial del catálogo" />
        </label>
        {installed && <p className="mt-1">Para actualizar o reinstalar, deshabilita la extensión y deja sólo una pestaña en about:blank. Se conservan tus restricciones por sitio y se sustituye la copia anterior sólo después de validar y cargar la nueva.</p>}
        <button type="button" disabled={busy || installed?.enabled} className="mt-2 soflia-browser-button soflia-browser-button--secondary" onClick={() => void review(entry, installed)}>
          {busy ? 'Verificando…' : installed ? 'Revisar actualización o reinstalación' : 'Verificar carpeta oficial'}
        </button>
      </div>;
    })}
    {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
  </section>;
}
