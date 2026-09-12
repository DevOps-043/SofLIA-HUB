import { useCallback, useEffect, useRef, useState } from 'react';
import { integratedBrowserService, type BrowserSyncDeviceStatus, type BrowserSyncDevicesResponse } from '../../services/integrated-browser-service';
import { BrowserSyncControls } from './BrowserSyncControls';

/** Sólo dispositivos: no simula una activación de transferencia todavía ausente. */
export function BrowserSyncPanel() {
  const [status, setStatus] = useState<BrowserSyncDeviceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const locked = useRef(false);
  const run = useCallback(async (operation: () => Promise<BrowserSyncDevicesResponse>) => {
    if (locked.current) return;
    locked.current = true;
    const id = ++request.current;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await operation();
      if (!mounted.current || id !== request.current) return;
      if (!response.success || !response.syncDevices) { setError(response.error || 'No se pudo consultar sincronización.'); setStatus(null); }
      else { setStatus(response.syncDevices); if (response.syncDevices.canceled) setNotice('No se confirmó la operación.'); }
    } catch {
      if (mounted.current && id === request.current) { setError('No se pudo consultar sincronización.'); setStatus(null); }
    } finally {
      if (id === request.current) { locked.current = false; if (mounted.current) setBusy(false); }
    }
  }, []);
  const cancel = async () => {
    const id = request.current;
    try {
      const response = await integratedBrowserService.cancelSyncOperation();
      if (!response.success && mounted.current && request.current === id) setError('No se pudo solicitar la cancelación.');
    } catch {
      if (mounted.current && request.current === id) setError('No se pudo solicitar la cancelación.');
    }
  };
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void Promise.resolve().then(() => { if (active) void run(() => integratedBrowserService.getSyncDevices()); });
    return () => { active = false; mounted.current = false; void integratedBrowserService.cancelSyncOperation().catch(() => undefined); };
    // El contenedor se remonta al cambiar el perfil; no compartir respuestas.
  }, [run]);

  return <section className="space-y-4" aria-label="Sincronización y dispositivos" aria-busy={busy}>
    <p className="text-sm text-secondary">Administra los dispositivos de tu cuenta Lia. Registrar un dispositivo todavía no activa la transferencia: configura la clave y las categorías en Datos sincronizados.</p>
    <p className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-secondary">Las contraseñas, cookies y passkeys quedan fuera de esta sincronización. Revocar impide accesos nuevos, pero no borra copias descargadas.</p>
    {status && <p role="status" className="text-sm text-secondary">{status.message}</p>}
    {notice && <p role="status" className="text-sm text-secondary">{notice}</p>}
    {error && <p role="alert" className="text-sm text-secondary">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void run(() => integratedBrowserService.getSyncDevices())} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50">Actualizar dispositivos</button>
      <button type="button" disabled={busy || !status?.enabled || status.state !== 'inactive'} onClick={() => void run(() => integratedBrowserService.registerSyncDevice())} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50">Registrar este dispositivo</button>
      {busy && <button type="button" className="rounded-xl border border-border px-3 py-2 text-sm" onClick={() => void cancel()}>Cancelar operación</button>}
    </div>
    <ul className="space-y-2" aria-label="Dispositivos registrados">
      {status?.devices.map((device) => <li key={device.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div><p className="text-sm font-semibold">{device.label}</p><p className="text-xs text-secondary">Registrado: {new Date(device.createdAt).toLocaleDateString('es-MX')}{device.revokedAt ? ' · Revocado' : ''}</p></div>
        <button type="button" disabled={busy || !!device.revokedAt} onClick={() => void run(() => integratedBrowserService.revokeSyncDevice(device.id))} className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50" aria-label={`Revocar ${device.label}`}>Revocar</button>
      </li>)}
    </ul>
    <BrowserSyncControls />
  </section>;
}
