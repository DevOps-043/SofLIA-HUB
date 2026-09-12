import { useEffect, useRef, useState, type ReactNode } from 'react';
import { integratedBrowserService, type IntegratedBrowserState } from '../../services/integrated-browser-service';

/** Monta la biblioteca sólo mientras main confirma que sigue desbloqueada. */
export function BrowserCredentialGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IntegratedBrowserState | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const generation = useRef(0); const profile = useRef<number | undefined>(undefined);
  useEffect(() => {
    let alive = true; let received = false;
    const invalidate = () => { ++generation.current; };
    const accept = (value: IntegratedBrowserState) => {
      if (!alive) return;
      if (profile.current !== value.profileRevision) { ++generation.current; setError(null); setBusy(false); }
      profile.current = value.profileRevision; setState(value);
    };
    const off = integratedBrowserService.subscribe({ onStateChanged: value => { received = true; accept(value); } });
    void integratedBrowserService.getState().then(result => { if (!received && result.success && result.state) accept(result.state); })
      .catch(() => { if (alive) setError('No se pudo consultar la bóveda.'); });
    return () => { alive = false; invalidate(); off(); };
  }, []);
  const run = async (action: 'unlock' | 'lock') => {
    if (busy || state?.profileRevision === undefined) return;
    const revision = generation.current; setBusy(true); setError(null);
    try {
      const result = await integratedBrowserService.credentialSessionCommand({ action, profileRevision: state.profileRevision });
      if (revision !== generation.current) return;
      // La respuesta no concede permisos a la UI; sólo el estado vigente de main.
      if (!result.success) setError(result.error || 'La bóveda sigue bloqueada.');
    } catch { if (revision === generation.current) setError('No se pudo verificar la bóveda.'); }
    finally { if (revision === generation.current) setBusy(false); }
  };
  return <section className="space-y-3">
    <p className="text-xs text-secondary">Verificación con Windows Hello/PIN. Bloqueo automático a los cinco minutos, al bloquear o suspender el equipo y al cambiar de perfil. Pulse Hub no recibe tu PIN ni biometría.</p>
    <button type="button" className="soflia-browser-button" disabled={busy || state?.profileRevision === undefined} onClick={() => void run(state?.credentialUnlocked ? 'lock' : 'unlock')}>
      {busy ? 'Esperando a Windows…' : state?.credentialUnlocked ? 'Bloquear bóveda' : 'Desbloquear con Windows'}
    </button>
    {error && <p role="alert">{error}</p>}
    {state?.credentialUnlocked ? children : <p role="status">Bóveda bloqueada. Tus credenciales permanecen cifradas en este equipo.</p>}
  </section>;
}
