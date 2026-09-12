import { checkBrowserNavigation, checkBrowserNavigationLocal, type BrowserNavigationSafetyVerdict } from './safe-navigation';

const MAX_PENDING_CHECKS = 32;
type Pending = { subject: object; frame: string; controller: AbortController };

/** Revisiones efímeras de solicitudes; sin caché de reputación ni contenido persistido. */
export class BrowserRequestSafety {
  private readonly pending = new Set<Pending>();
  constructor(private readonly check = checkBrowserNavigation) {}

  invalidate(subject: object, frame: string): void {
    for (const entry of this.pending) {
      if (entry.subject === subject && (frame === 'main' || entry.frame === frame)) entry.controller.abort();
    }
  }

  cancelAll(): void { for (const entry of this.pending) entry.controller.abort(); }

  async review(url: string, subject: object, frame: string, isCurrent: () => boolean): Promise<BrowserNavigationSafetyVerdict | null> {
    if (!isCurrent()) return null;
    if (this.pending.size >= MAX_PENDING_CHECKS) return degraded(url, 'La revisión remota alcanzó su límite temporal; se aplicó la protección local.');
    const entry: Pending = { subject, frame, controller: new AbortController() };
    this.pending.add(entry);
    try {
      const result = await this.check(url, { allowRemote: true, signal: entry.controller.signal });
      return !entry.controller.signal.aborted && isCurrent() ? result : null;
    } catch {
      return !entry.controller.signal.aborted && isCurrent()
        ? degraded(url, 'No se pudo consultar el proveedor; se aplicó la protección local.') : null;
    } finally { this.pending.delete(entry); }
  }
}

function degraded(url: string, reason: string): BrowserNavigationSafetyVerdict {
  const local = checkBrowserNavigationLocal(url);
  return { ...local, source: 'degraded', reason: local.reason ?? reason };
}
