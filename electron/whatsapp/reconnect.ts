import { onAuthStateChange } from '../main/auth-state';
import type { WhatsAppServiceCore } from './types';

const pending = new WeakMap<WhatsAppServiceCore, { timer: ReturnType<typeof setTimeout>; unsubscribe: () => void }>();

export function cancelWhatsAppReconnect(service: WhatsAppServiceCore): void {
  const entry = pending.get(service);
  if (!entry) return;
  clearTimeout(entry.timer); entry.unsubscribe(); pending.delete(service);
}

export function scheduleWhatsAppReconnect(service: WhatsAppServiceCore, delay: number): void {
  cancelWhatsAppReconnect(service);
  const timer = setTimeout(() => {
    void Promise.resolve().then(() => {
      if (pending.get(service)?.timer !== timer) return;
      cancelWhatsAppReconnect(service);
      if (!service.sock) return service.connect();
    }).catch(() => {
      console.error('[WhatsApp] No se pudo completar la reconexión.');
    });
  }, delay);
  timer.unref?.();
  const unsubscribe = onAuthStateChange(() => cancelWhatsAppReconnect(service));
  pending.set(service, { timer, unsubscribe });
}
