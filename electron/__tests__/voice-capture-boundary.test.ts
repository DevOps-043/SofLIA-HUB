import { describe, expect, it, vi } from 'vitest';
import { PythonRuntimeService } from '../python-runtime-service';

describe('Frontera nativa de captura local', () => {
  it.each(['start_wake', 'start_dictation', 'mic_probe'])('deniega %s sin autorización main antes de escribir', async cmd => {
    const service = new PythonRuntimeService();
    const request = vi.fn(async () => ({ ok: true }));
    Object.assign(service, { connection: { request } });
    await expect(service.sendCommand(cmd, {})).rejects.toThrow('voice_approval_required');
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['start_wake', 'start_dictation', 'mic_probe'])('las notificaciones tampoco omiten la guardia: %s', cmd => {
    const service = new PythonRuntimeService(); const notify = vi.fn(); Object.assign(service, { connection: { notify } });
    expect(() => service.sendNotification(cmd, {})).toThrow('voice_approval_required'); expect(notify).not.toHaveBeenCalled();
  });
  it('un grant no autoriza parámetros distintos del dispositivo/modelo configurados', async () => {
    const service = new PythonRuntimeService(); service.configureCaptureAuthorization(() => {});
    const request = vi.fn(); Object.assign(service, { connection: { request } });
    await expect(service.sendCommand('start_wake', { device: 'otro', model_path: 'otro' })).rejects.toThrow('voice_approval_required');
    expect(request).not.toHaveBeenCalled();
  });
  it('init no inicia captura aunque enabled esté guardado', async () => {
    const service = new PythonRuntimeService();
    const internals = service as unknown as { loadConfig(): void; isRuntimeAvailable(): boolean };
    vi.spyOn(internals, 'loadConfig').mockImplementation(() => { Object.assign(service, { config: { ...service.getConfig(), enabled: true } }); });
    vi.spyOn(internals, 'isRuntimeAvailable').mockReturnValue(true);
    const start = vi.spyOn(service, 'startPassiveListening'); await service.init(); expect(start).not.toHaveBeenCalled();
  });
});
