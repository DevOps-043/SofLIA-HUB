import type { BrowserNavigationSafetyVerdict } from '../../services/integrated-browser-service';

/** Estado proporcionado por main; nunca confundir una consulta caída con un sitio bloqueado. */
export function BrowserNavigationSafetyNotice({ verdict }: { verdict?: BrowserNavigationSafetyVerdict | null }) {
  if (!verdict || (verdict.action === 'allow' && verdict.source !== 'degraded')) return null;
  const blocked = verdict.action === 'block';
  const degraded = verdict.source === 'degraded';
  return <div role={blocked ? 'alert' : 'status'} aria-atomic="true"
    className={`rounded-lg border px-3 py-2 text-xs ${blocked
      ? 'border-danger/30 bg-danger/10 text-danger'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'}`}>
    <p className="font-semibold">{blocked ? 'Último intento de navegación bloqueado'
      : verdict.action === 'warn' ? 'Comprueba el sitio antes de continuar' : 'Revisión remota no disponible'}</p>
    {verdict.action !== 'allow' && <p>{verdict.reason || 'Revisa la dirección antes de introducir datos personales.'}</p>}
    <p className="mt-1">{degraded
      ? 'La protección local sigue activa. Esta navegación no se comprobó con el proveedor remoto.'
      : verdict.source === 'remote' ? 'Aviso del proveedor de navegación segura.' : 'Aviso de la revisión local del navegador.'}</p>
  </div>;
}
