import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PythonRuntimeService } from '../python-runtime-service';
import { VoiceConsentStore } from '../voice/consent-store';
import { deferred } from './project-hub/fixtures';

const { prepare } = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock('../python/automatic-setup', () => ({ preparePrivatePython: prepare }));
afterEach(() => { vi.restoreAllMocks(); prepare.mockReset(); });

function fixture() {
  const service = new PythonRuntimeService();
  const internals = service as unknown as {
    isRuntimeAvailable(): boolean; assertRuntimeAvailable(): void; resolveModelPathFor(size: string): string | null;
  };
  const runtime = vi.spyOn(internals, 'isRuntimeAvailable').mockReturnValue(false);
  vi.spyOn(internals, 'assertRuntimeAvailable').mockImplementation(() => {});
  const model = vi.spyOn(internals, 'resolveModelPathFor').mockReturnValue(null);
  const install = vi.spyOn(service, 'installModel').mockResolvedValue({ success: true });
  const capture = vi.spyOn(service, 'startPassiveListening');
  return { service, runtime, model, install, capture };
}

describe('Preparación automática sin captura', () => {
  it('comparte instalación concurrente y prepara el modelo sin activar escucha', async () => {
    const { service, install, capture } = fixture();
    const download = deferred<void>(); prepare.mockReturnValue(download.promise);
    const first = service.prepareVoice(); const second = service.prepareVoice();
    expect(service.getStatus().setupState).toBe('runtime');
    expect(prepare).toHaveBeenCalledOnce(); expect(install).not.toHaveBeenCalled();
    download.resolve(); await Promise.all([first, second]);
    expect(install).toHaveBeenCalledExactlyOnceWith('small', false);
    expect(service.getStatus().setupState).toBe('ready'); expect(capture).not.toHaveBeenCalled();
  });
  it('reutiliza recursos instalados sin red', async () => {
    const { service, runtime, model, install } = fixture();
    runtime.mockReturnValue(true); model.mockReturnValue('modelo-local');
    await service.prepareVoice();
    expect(prepare).not.toHaveBeenCalled(); expect(install).not.toHaveBeenCalled();
  });
  it('un fallo deja estado recuperable y permite reintentar', async () => {
    const { service, capture } = fixture();
    prepare.mockRejectedValueOnce(new Error('Detalle privado')).mockResolvedValueOnce(undefined);
    await expect(service.prepareVoice()).rejects.toThrow('voice_setup_failed');
    expect(service.getStatus().setupState).toBe('error');
    expect(service.getStatus().lastError).not.toContain('privado');
    await service.prepareVoice(); expect(service.getStatus().setupState).toBe('ready');
    expect(prepare).toHaveBeenCalledTimes(2); expect(capture).not.toHaveBeenCalled();
  });
  it('fallar el modelo tampoco comunica éxito', async () => {
    const { service, runtime, install, capture } = fixture(); runtime.mockReturnValue(true);
    install.mockResolvedValueOnce({ success: false });
    await expect(service.prepareVoice()).rejects.toThrow('voice_setup_failed');
    expect(service.getStatus().setupState).toBe('error'); expect(capture).not.toHaveBeenCalled();
  });
});

describe('Consentimiento de voz persistente', () => {
  const directories: string[] = [];
  afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
  function store() {
    const directory = mkdtempSync(path.join(tmpdir(), 'soflia-voice-consent-')); directories.push(directory);
    return { directory, consent: new VoiceConsentStore(directory) };
  }
  it('persiste entre instancias, sin otorgar permiso a otra cuenta o configuración', () => {
    const { directory, consent } = store();
    expect(consent.allows('A', 'mic-1', 'passive')).toBe(false);
    consent.remember('A', 'mic-1', 'passive');
    const restored = new VoiceConsentStore(directory);
    expect(restored.allows('A', 'mic-1', 'dictation')).toBe(true);
    expect(restored.allows('B', 'mic-1', 'dictation')).toBe(false);
    expect(restored.allows('A', 'mic-2', 'passive')).toBe(false);
    restored.forget('A'); expect(consent.allows('A', 'mic-1', 'passive')).toBe(false);
  });
  it('dictado no concede escucha pasiva y corrupción falla cerrado', () => {
    const { consent } = store(); consent.remember('../A', 'config', 'dictation');
    expect(consent.allows('../A', 'config', 'passive')).toBe(false);
    expect(consent.allows('../A', 'config', 'dictation')).toBe(true);
    const file = (consent as unknown as { file(user: string): string }).file('../A');
    writeFileSync(file, '{incompleto'); expect(consent.allows('../A', 'config', 'dictation')).toBe(false);
  });
});
