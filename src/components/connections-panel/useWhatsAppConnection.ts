import { useCallback, useEffect, useRef, useState } from 'react';
import './window-connections';
import type { WhatsAppConnectionState, WhatsAppStatus } from './types';

export function useWhatsAppConnection(apiKey?: string): WhatsAppConnectionState {
  const [status, setStatus] = useState<WhatsAppStatus>({ connected: false, phoneNumber: null, qr: null });
  const [connecting, setConnecting] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!window.whatsApp || initialized.current) return;
    initialized.current = true;
    window.whatsApp.getStatus().then((snapshot) =>
      setStatus({ connected: snapshot.connected, phoneNumber: snapshot.phoneNumber, qr: snapshot.qr }),
    );
    if (apiKey) window.whatsApp.setApiKey(apiKey);
    window.whatsApp.onQR((qr: string) => {
      setStatus((prev) => ({ ...prev, qr }));
      setConnecting(false);
    });
    window.whatsApp.onStatusChange((snapshot: any) => {
      setStatus({ connected: snapshot.connected, phoneNumber: snapshot.phoneNumber, qr: snapshot.qr });
      if (snapshot.connected) setConnecting(false);
    });
    return () => {
      window.whatsApp?.removeListeners();
      initialized.current = false;
    };
  }, [apiKey]);

  const connect = useCallback(async () => {
    if (!window.whatsApp) return;
    setConnecting(true);
    if (apiKey) await window.whatsApp.setApiKey(apiKey);
    const result = await window.whatsApp.connect();
    if (!result.success) setConnecting(false);
  }, [apiKey]);

  const disconnect = useCallback(async () => {
    if (!window.whatsApp) return;
    await window.whatsApp.disconnect();
    setStatus({ connected: false, phoneNumber: null, qr: null });
  }, []);

  return { status, connecting, connect, disconnect };
}
