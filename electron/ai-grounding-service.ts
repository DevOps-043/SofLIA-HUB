import { fetchGroundedContent, GroundedProviderError } from '../src/shared/grounded-http';
import { GROUNDED_REQUEST_MS, type GroundedGenerateInput, type GroundedGenerateReply } from '../src/shared/grounded-generation';

interface GroundingAuthority { frame: unknown; user: string; signal: AbortSignal; assertCurrent(): void; key(signal: AbortSignal): Promise<string> }
class GroundingCredentialError extends Error {}
interface GroundingJob { id: string; authority: GroundingAuthority; controller: AbortController }
/** Cuotas de trabajo físico, independientes de que el renderer abandone la espera. */
export class AiGroundingService {
  private readonly jobs = new Map<object, GroundingJob>();
  async generate(sender: object, input: GroundedGenerateInput, authority: GroundingAuthority): Promise<GroundedGenerateReply> {
    authority.assertCurrent();
    if (this.jobs.has(sender) || this.jobs.size >= 4) return { success: false, code: 'BUSY', error: 'Ya hay una investigación en curso. Espera antes de repetir.' };
    const controller = new AbortController();
    const job = { id: input.requestId ?? '', authority, controller }; this.jobs.set(sender, job);
    const revoke = () => controller.abort();
    authority.signal.addEventListener('abort', revoke, { once: true });
    if (authority.signal.aborted) revoke();
    const timer = setTimeout(revoke, GROUNDED_REQUEST_MS);
    let aborted!: () => void;
    const cancellation = new Promise<never>((_resolve, reject) => {
      aborted = () => reject(new Error('Investigación cancelada.'));
      controller.signal.addEventListener('abort', aborted, { once: true });
      if (controller.signal.aborted) aborted();
    });
    // La plaza cubre la consulta de clave, el transporte y el cierre de lectura.
    const physical = Promise.resolve().then(async () => {
      authority.assertCurrent();
      controller.signal.throwIfAborted();
      let key: string;
      try { key = await authority.key(controller.signal); }
      catch { throw new GroundingCredentialError(); }
      authority.assertCurrent();
      controller.signal.throwIfAborted();
      return fetchGroundedContent(input, key, controller.signal);
    })
      .finally(() => { if (this.jobs.get(sender) === job) this.jobs.delete(sender); });
    try {
      const payload = await Promise.race([physical, cancellation]);
      authority.assertCurrent();
      controller.signal.throwIfAborted();
      return { success: true, payload };
    } catch (error) {
      if (controller.signal.aborted) return { success: false, code: 'CANCELLED', error: 'Investigación cancelada o vencida.' };
      if (error instanceof GroundingCredentialError) return { success: false, code: 'CREDENTIAL_FAILED', error: 'No se pudo resolver la credencial de investigación.' };
      return { success: false, code: 'PROVIDER_FAILED', error: 'No se pudo completar la investigación con el proveedor.',
        ...(error instanceof GroundedProviderError && error.status ? { status: error.status } : {}) };
    } finally { clearTimeout(timer); authority.signal.removeEventListener('abort', revoke); controller.signal.removeEventListener('abort', aborted); }
  }
  cancel(sender: object, id: string, frame: unknown, user: string): boolean {
    const job = this.jobs.get(sender);
    if (!job || job.id !== id || job.authority.frame !== frame || job.authority.user !== user) return false;
    try { job.authority.assertCurrent(); } catch { return false; }
    job.controller.abort(); return true;
  }
}
