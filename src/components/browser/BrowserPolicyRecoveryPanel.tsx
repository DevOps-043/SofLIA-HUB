import { useEffect, useRef, useState } from 'react';
import { integratedBrowserService, type BrowserProfileDescriptor } from '../../services/integrated-browser-service';
import { POLICY_RECOVERY_LABELS, type BrowserPolicyRecoveryRequest } from '../../shared/browser-policy-recovery';

export function BrowserPolicyRecoveryPanel({ profile }: { profile: BrowserProfileDescriptor }) {
  return <RecoveryControls key={profile.id} profile={profile} />;
}

function RecoveryControls({ profile }: { profile: BrowserProfileDescriptor }) {
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => { const current = ++generation.current; return () => { generation.current = current + 1; }; }, []);
  const recover = async (store: BrowserPolicyRecoveryRequest['store']) => {
    if (pending.current) return; pending.current = true; setBusy(true); setError(''); setMessage(''); const current = generation.current;
    try {
      const [state, owner] = await Promise.all([integratedBrowserService.getState(), integratedBrowserService.getProfile()]);
      if (current !== generation.current) return;
      if (!state.success || !Number.isSafeInteger(state.state?.profileRevision) || !owner.success || owner.profile?.id !== profile.id) throw new Error();
      const result = await integratedBrowserService.recoverPolicyStore({ store, profileRevision: state.state!.profileRevision! });
      if (current !== generation.current) return;
      if (!result.success) setError(result.error || 'No se pudo recuperar el almacén.');
      else if (result.cancelled) setMessage('Recuperación cancelada.');
      else if (Number.isSafeInteger(result.restored) && result.restored! >= 0) setMessage(store === 'history' || store === 'audit'
        ? `Recuperadas ${result.restored} entradas de ${POLICY_RECOVERY_LABELS[store]}. Actualiza su lista; se aplica retención y no se modifica sincronización.`
        : store === 'semantic'
        ? 'Memoria recuperada vacía y desactivada. Actívala con consentimiento para reconstruirla; no se contactó al proveedor.'
        : store === 'shortcuts'
        ? `Recuperados ${result.restored} atajos. Actualiza su lista y revisa las instrucciones antes de usarlas; no se ejecutó ningún atajo.`
        : `Recuperados ${result.restored} sitios con restricciones. Revisa los ajustes antes de conceder nuevos permisos.`);
      else throw new Error();
    } catch { if (current === generation.current) setError('No se pudo recuperar el almacén. Vuelve a revisar el perfil y el respaldo.'); }
    finally { pending.current = false; if (current === generation.current) setBusy(false); }
  };
  return <section className="rounded-xl border border-border bg-card p-3 text-xs" aria-label="Recuperación de ajustes">
    <h3 className="font-semibold text-primary">Recuperar ajustes dañados</h3>
    <p className="mt-2 text-secondary">Sólo si el archivo falta o está dañado y existe respaldo local protegido por el sistema operativo. Se conserva la versión anterior antes de modificar un archivo existente. No restaura permisos concedidos ni excepciones: privacidad estricta y agente con nueva autorización. Los atajos recuperados deben revisarse antes de usar. La memoria se recupera vacía y desactivada; su copia dañada se retira en la siguiente modificación. Atajos y memoria requieren gobierno del agente habilitado. No incluye contraseñas ni sincronización.</p>
    <div className="mt-2 flex flex-wrap gap-2">{(Object.keys(POLICY_RECOVERY_LABELS) as BrowserPolicyRecoveryRequest['store'][]).map(store =>
      <button key={store} type="button" disabled={busy || profile.kind !== 'authenticated'} className="soflia-browser-button min-h-9 px-3" onClick={() => void recover(store)}>Recuperar {POLICY_RECOVERY_LABELS[store]}</button>)}</div>
    {busy && <p role="status">Revisando respaldo y confirmación…</p>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}
