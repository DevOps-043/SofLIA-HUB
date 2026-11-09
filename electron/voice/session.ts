import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { nativeConfirmation, trustedAppCaller, trustedAppWindow } from '../ipc/caller-authorization';
import type { PythonRuntimeService, VoicePassiveConfig } from '../python-runtime-service';
import { captureSignature, parseVoiceConfig, publicVoiceConfig, publicVoiceStatus } from './contract';

type Caller = ReturnType<typeof trustedAppCaller>;
export interface VoiceCall extends Caller { effectStarted: boolean }
type Mode = 'passive' | 'dictation' | 'probe';
interface Grant { epoch: number; signature: string; mode: 'passive' | 'dictation' }
interface Pending { cancellation: AbortController; invoked: boolean; parent: BrowserWindow | null; capture: boolean }

/** Autorización efímera de sesión; las preferencias persistidas nunca son grants. */
export class LocalVoiceSession {
  private epoch = 0;
  private grant: Grant | null = null;
  private probe: { epoch: number; device: unknown; signal: AbortSignal } | null = null;
  private pending: Pending | null = null;
  private readonly confirm = nativeConfirmation('Autorizar voz local');
  private readonly unsubscribe: () => void;
  constructor(readonly runtime: PythonRuntimeService, private readonly getMain: () => BrowserWindow | null,
    private readonly getOrb: () => BrowserWindow | null, private readonly clearPendingWake: () => void = () => {}) {
    runtime.configureCaptureAuthorization((cmd, params) => this.assertCapture(cmd, params));
    this.unsubscribe = onAuthStateChange(() => {
      this.epoch++; this.revoke();
      const epoch = this.epoch;
      void this.stopRuntime().then(() => { if (epoch === this.epoch) return this.restore(); }).catch(() => {
        console.warn('[VozLocal] No se pudo restaurar la voz de esta sesión.');
      });
    });
  }
  caller(event: IpcMainInvokeEvent, role: 'main' | 'orb' | 'both', visible = false): VoiceCall {
    const source = trustedAppCaller(event, () => role === 'main' ? [this.getMain()] : role === 'orb' ? [this.getOrb()] : [this.getMain(), this.getOrb()]);
    const assert = () => { source.assert(); if (visible && !source.parent?.isVisible()) throw new Error('context_invalid'); };
    return { ...source, assert, effectStarted: false };
  }
  isApproved(mode: 'passive' | 'dictation' = 'passive', config = this.runtime.getConfig()): boolean {
    const auth = getAuthState();
    return Boolean(auth.authenticated && auth.userId && this.grant?.epoch === this.epoch
      && this.grant.signature === captureSignature(config) && (this.grant.mode === 'passive' || mode === 'dictation'));
  }
  snapshot() {
    parseVoiceConfig(this.runtime.getConfig());
    return { status: publicVoiceStatus(this.runtime.getStatus(), this.isApproved()), config: publicVoiceConfig(this.runtime.getConfig()) };
  }
  private assertCapture(cmd: string, params: Record<string, unknown>): void {
    if (cmd === 'mic_probe') {
      if (!getAuthState().authenticated || !this.probe || this.probe.epoch !== this.epoch || this.probe.signal.aborted
        || params.device !== this.probe.device || params.seconds !== 3) throw new Error('voice_approval_required');
    } else if (!this.isApproved(cmd === 'start_wake' ? 'passive' : 'dictation')) throw new Error('voice_approval_required');
  }
  private revoke(): void {
    this.grant = null; this.probe = null; this.pending?.cancellation.abort(); this.clearPendingWake();
  }
  private async stopRuntime(): Promise<void> {
    // Revocar invalida las respuestas en vuelo antes del cierre físico del hijo.
    this.runtime.emit('sidecar-unavailable');
    await this.runtime.stop();
  }
  async stop(call: VoiceCall): Promise<void> {
    call.assert(); this.revoke(); call.effectStarted = true; await this.stopRuntime(); call.assert();
  }
  cancelCapture(): void {
    this.revoke(); void this.stopRuntime().catch(() => console.warn('[VozLocal] Cierre de captura sin confirmar.'));
  }
  cancelPendingCapture(call: VoiceCall): boolean {
    call.assert(); const pending = this.pending;
    if (!pending?.capture || pending.parent !== call.parent) return false;
    pending.cancellation.abort(); return true;
  }
  async capture<T>(call: VoiceCall, mode: Mode, run: () => Promise<T>, config = this.runtime.getConfig(), device: unknown = config.micDevice ?? null): Promise<T> {
    parseVoiceConfig(config);
    return this.control(call, async (pending, signal) => {
      if (mode === 'probe' || !this.isApproved(mode, config)) {
        const detail = `Usuario: ${call.userId}\nAlcance: ${mode === 'probe' ? 'Prueba de micrófono de 3 segundos' : mode === 'passive' ? 'Escucha de activación y dictado durante esta sesión' : 'Dictado durante esta sesión'}\n`
          + `Micrófono: ${JSON.stringify(device)}\nModelo: ${JSON.stringify(config.modelPath ?? 'Modelo local instalado')}\nPalabras: ${JSON.stringify(config.wakeWords)}\nCerrar sesión revoca la autorización.`;
        if (!await this.confirm(call.parent!, detail, call.assert, signal)) throw new Error('approval_cancelled');
      }
      call.assert(); if (signal.aborted) throw new Error('approval_cancelled');
      if (mode === 'probe') this.probe = { epoch: this.epoch, device, signal };
      else if (!this.isApproved(mode, config)) this.grant = { epoch: this.epoch, mode, signature: captureSignature(config) };
      pending.invoked = true; call.effectStarted = true;
      try { const result = await run(); call.assert(); if (signal.aborted) throw new Error('approval_cancelled'); return result; }
      finally { if (mode === 'probe') this.probe = null; }
    });
  }
  async install<T>(call: VoiceCall, description: string, run: () => Promise<T>): Promise<T> {
    return this.control(call, async (pending, signal) => {
      if (!await this.confirm(call.parent!, `Usuario: ${call.userId}\n${description}\nSe descargarán archivos del proveedor al equipo. Una descarga iniciada puede completar aunque cierres la ventana.`, call.assert, signal)) throw new Error('approval_cancelled');
      call.assert(); if (signal.aborted) throw new Error('approval_cancelled');
      pending.invoked = true; call.effectStarted = true;
      const result = await run(); call.assert(); if (signal.aborted) throw new Error('approval_cancelled'); return result;
    }, false);
  }
  private async control<T>(call: VoiceCall, run: (pending: Pending, signal: AbortSignal) => Promise<T>, capture = true): Promise<T> {
    call.assert(); if (this.pending) throw new Error('approval_pending');
    const pending: Pending = { cancellation: new AbortController(), invoked: false, parent: call.parent ?? null, capture }; this.pending = pending;
    const signal = AbortSignal.any([call.signal, pending.cancellation.signal]);
    let retired = false;
    const cancelled = () => {
      if (capture && pending.invoked && !retired) { retired = true; this.grant = null; this.probe = null; void this.stopRuntime().catch(() => console.warn('[VozLocal] Cierre de captura sin confirmar.')); }
    };
    signal.addEventListener('abort', cancelled, { once: true });
    try { return await run(pending, signal); }
    catch (error) { cancelled(); throw error; }
    finally { signal.removeEventListener('abort', cancelled); if (this.pending === pending) this.pending = null; }
  }
  async setConfig(call: VoiceCall, updates: Partial<VoicePassiveConfig>): Promise<void> {
    call.assert();
    const previous = this.runtime.getConfig(); const next = { ...previous, ...updates };
    const changed = captureSignature(next) !== captureSignature(previous);
    if (changed && this.runtime.getStatus().dictating) throw new Error('voice_busy');
    if (updates.enabled === false) {
      await this.stop(call); call.assert(); await this.runtime.setConfig(updates, false); call.assert(); return;
    }
    if (next.enabled && (updates.enabled === true || this.runtime.getStatus().listening)) {
      await this.capture(call, 'passive', async () => {
        if (changed) await this.runtime.stopPassiveListening(); call.assert();
        await this.runtime.setConfig(updates, false); call.assert();
        const result = await this.runtime.startPassiveListening(); if (!result.success) throw new Error('voice_unavailable');
      }, next); return;
    }
    if (this.pending) throw new Error('approval_pending');
    if (changed) this.grant = null;
    call.effectStarted = true; await this.runtime.setConfig(updates, false); call.assert();
  }
  private async restore(): Promise<void> {
    if (!getAuthState().authenticated || !this.runtime.getConfig().enabled) return;
    let call: VoiceCall | undefined;
    try {
      call = { ...trustedAppWindow(() => [this.getMain()]), effectStarted: false };
      await this.capture(call, 'passive', async () => {
        const result = await this.runtime.startPassiveListening(); if (!result.success) throw new Error('voice_unavailable');
      });
    } catch { /* La UI permite volver a activar; una restauración no repite la aprobación. */ }
    finally { call?.dispose(); }
  }
  dispose(): void { this.unsubscribe(); this.epoch++; this.cancelCapture(); }
}

export function voiceFailure(error: unknown, call?: VoiceCall) {
  const code = error instanceof Error && error.name === 'ZodError' ? 'voice_invalid_input'
    : error instanceof Error && ['context_invalid', 'approval_cancelled', 'approval_expired', 'approval_pending', 'voice_busy', 'voice_approval_required', 'voice_invalid_input'].includes(error.message)
      ? error.message : 'voice_unavailable';
  return { success: false as const, code, error: code === 'voice_unavailable' ? 'No se pudo completar la operación de voz. Revisa el runtime, el modelo y el dispositivo.'
    : code === 'voice_invalid_input' ? 'La solicitud de voz no es válida.'
    : code === 'approval_pending' || code === 'voice_busy' ? 'Hay una operación de voz en curso. Puedes detenerla desde los controles.'
      : 'La operación de voz requiere una sesión y autorización vigentes.',
  ...(call?.effectStarted ? { uncertain: true, recoveryRequired: true } : {}) };
}
