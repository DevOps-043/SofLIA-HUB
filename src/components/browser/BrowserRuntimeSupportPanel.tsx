import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserPolicyRecoveryPanel } from './BrowserPolicyRecoveryPanel';
import { integratedBrowserService, type BrowserProfileDescriptor, type BrowserProfileKind, type BrowserRuntimeDiagnostic } from '../../services/integrated-browser-service';

export function BrowserRuntimeSupportPanel() {
  const [diagnostic, setDiagnostic] = useState<BrowserRuntimeDiagnostic | null>(null);
  const [profile, setProfile] = useState<BrowserProfileDescriptor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const generation = useRef(0);
  const exportPending = useRef(false);
  const load = useCallback(() => {
    const request = ++generation.current;
    // También convertir la ausencia síncrona del bridge en un error recuperable.
    return Promise.resolve().then(() => Promise.all([integratedBrowserService.getRuntimeDiagnostic(), integratedBrowserService.getProfile()])).then(([response, profileResponse]) => {
      if (request !== generation.current) return;
      if (!response.success || !response.diagnostic) setError(response.error || 'No se pudo generar el diagnóstico.');
      else setDiagnostic(response.diagnostic);
      if (!profileResponse.success || !profileResponse.profile) setError(profileResponse.error || 'No se pudo consultar el perfil.');
      else setProfile(profileResponse.profile);
    }).catch(() => {
      if (request === generation.current) setError('No se pudo consultar el diagnóstico. Vuelve a intentarlo.');
    }).finally(() => { if (request === generation.current) setLoading(false); });
  }, []);
  useEffect(() => {
    const pending = generation;
    void load();
    return () => { pending.current++; };
  }, [load]);

  const exportReport = async () => {
    if (exportPending.current) return;
    const request = generation.current;
    exportPending.current = true;
    setExporting(true); setError(null); setNotice(null);
    try {
      const response = await integratedBrowserService.exportRuntimeDiagnostic();
      if (request !== generation.current) return;
      if (!response.success || !response.diagnosticExport) setError(response.error || 'No se pudo exportar el diagnóstico.');
      else if (!response.diagnosticExport.cancelled && response.diagnosticExport.exported) setNotice('Diagnóstico guardado. No se envió a ningún servidor.');
    } catch {
      if (request === generation.current) setError('No se pudo exportar el diagnóstico. Vuelve a intentarlo.');
    } finally {
      exportPending.current = false;
      if (request === generation.current) setExporting(false);
    }
  };
  const changeProfile = async (kind: BrowserProfileKind) => {
    if (kind === profile?.kind) return;
    const request = ++generation.current;
    setError(null); setNotice(null); setLoading(true);
    try {
      const response = await integratedBrowserService.setProfile(kind);
      if (request !== generation.current) return;
      if (!response.success || !response.profile) throw new Error(response.error || 'No se pudo cambiar el perfil.');
      setProfile(response.profile);
      setNotice(response.profile.kind === kind
        ? `${response.profile.label} activo. Las pestañas y datos del perfil anterior quedaron aislados.`
        : 'Cambio cancelado. Se conserva el perfil actual.');
      await load();
    } catch (failure) { if (request === generation.current) setError(failure instanceof Error ? failure.message : 'No se pudo cambiar el perfil.'); }
    finally { if (request === generation.current) setLoading(false); }
  };
  const rows = diagnostic ? [
    ['Pulse Hub', diagnostic.appVersion], ['Electron', diagnostic.electronVersion],
    ['Chromium', diagnostic.chromiumVersion], ['Node.js', diagnostic.nodeVersion],
    ['Perfil', diagnostic.profileKind === 'authenticated' ? 'Autenticado' : diagnostic.profileKind === 'private' ? 'Privado' : 'Invitado'],
    ['Protección', diagnostic.protectionLevel === 'off' ? 'Desactivada' : diagnostic.protectionLevel === 'strict' ? 'Estricta' : 'Equilibrada'],
    ['Política cargada', diagnostic.managed ? 'Sí' : 'No'],
    ...(diagnostic.enterprisePolicyStatus ? [['Verificación empresarial', { disabled: 'Desactivada', loading: 'Pendiente: acceso bloqueado', ready: 'Verificada', error: 'Error: acceso bloqueado' }[diagnostic.enterprisePolicyStatus]]] : []),
  ] : [];
  return <div className="space-y-3">
    <p className="text-xs text-secondary">Diagnóstico local con versiones y conteos actuales de pestañas, vistas, grupos y estados de descargas. Sin URLs, historial, nombres de archivos, contraseñas ni contenido. No se envía automáticamente.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-secondary">{notice}</p>}
    {loading && <p role="status" className="text-sm text-secondary">Consultando diagnóstico…</p>}
    {rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-xs"><span className="text-secondary">{label}</span><span className="font-mono text-primary dark:text-white/85">{value}</span></div>)}
    {profile && <div className="rounded-xl border border-border bg-card p-3">
      <label className="block text-xs font-semibold text-primary dark:text-white" htmlFor="browser-profile-kind">Perfil de navegación</label>
      <select id="browser-profile-kind" aria-label="Perfil de navegación" className="soflia-browser-field mt-2" value={profile.kind} disabled={loading || exporting} onChange={(event) => void changeProfile(event.target.value as BrowserProfileKind)}>
        <option value="authenticated">Autenticado · persistente</option>
        <option value="guest">Invitado · efímero</option>
        <option value="private">Privado · efímero</option>
      </select>
      <p className="mt-2 text-[11px] text-secondary">Invitado y privado usan sesiones no persistentes. Al cerrar sus ventanas se espera la limpieza de sus datos temporales; cancelar el cierre conserva la sesión. Tras un cierre forzado o una salida sin completar la limpieza aún pueden quedar archivos temporales. Cambiar de perfil requiere confirmación y cierra sus pestañas. Los archivos descargados no se borran.</p>
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={loading || exporting} className="soflia-browser-button min-h-9 px-3" onClick={() => { setLoading(true); setError(null); void load(); }}>Actualizar diagnóstico</button>
      <button type="button" disabled={loading || exporting || !diagnostic || diagnostic.profileKind !== 'authenticated'} className="soflia-browser-button min-h-9 px-3" onClick={() => void exportReport()}>{exporting ? 'Esperando confirmación…' : 'Exportar diagnóstico JSON'}</button>
    </div>
    <p className="text-xs text-secondary">Se pedirá confirmación y un archivo nuevo. Los conteos del JSON son una instantánea al solicitarlo, no totales históricos.</p>
    {profile && <BrowserPolicyRecoveryPanel key={profile.id} profile={profile} />}
  </div>;
}
