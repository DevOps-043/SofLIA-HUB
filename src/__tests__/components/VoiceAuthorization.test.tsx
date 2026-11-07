import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoicePassivePanel } from '../../components/voice-settings/useVoicePassivePanel';
import { ListeningCard } from '../../components/voice-settings/ListeningCard';
import type { VoicePassiveSnapshot } from '../../shared/local-voice';
const { service } = vi.hoisted(() => ({ service: { isAvailable: () => true, getStatus: vi.fn(), listMicDevices: vi.fn(), start: vi.fn(), stop: vi.fn(), setConfig: vi.fn(), installModel: vi.fn(), testMic: vi.fn() } }));
vi.mock('../../services/voice-passive-service', () => ({ voicePassiveService: service }));
function snapshot(): VoicePassiveSnapshot {
  return { success: true, config: { enabled: true, wakeWords: ['soflia'], micDevice: null, ttsVoice: 'Aoede', ttsSpeed: 1 },
    status: { runtimeAvailable: true, sidecarRunning: false, listening: false, enabled: true, modelInstalled: true, approvalRequired: true,
      largeModelInstalled: false, modelDownloadProgress: null, ttsReady: true, ttsDownloadProgress: null, dictating: false, lastError: null } };
}
function Panel() { const panel = useVoicePassivePanel(); return <><ListeningCard panel={panel} /><output>{panel.feedback?.message}</output></>; }
beforeEach(() => {
  vi.clearAllMocks(); service.getStatus.mockResolvedValue(snapshot()); service.listMicDevices.mockResolvedValue({ success: true, devices: [] });
  service.start.mockResolvedValue({ success: true }); service.stop.mockResolvedValue({ success: true });
});
afterEach(() => vi.useRealTimers());
describe('Ajustes de autorización de voz', () => {
  it('muestra autorización por sesión y permite detener incluso durante una solicitud pendiente', async () => {
    let finish!: (value: { success: boolean; error?: string }) => void;
    service.start.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<Panel />); fireEvent.click(await screen.findByRole('button', { name: 'Autorizar voz en esta sesión' }));
    expect(service.start).toHaveBeenCalledOnce();
    const stop = screen.getByRole('button', { name: 'Detener captura de voz' }); expect(stop).not.toBeDisabled(); fireEvent.click(stop);
    expect(service.stop).toHaveBeenCalledOnce();
    await act(async () => { finish({ success: false, error: 'Autorización cancelada.' }); });
    expect(screen.getByText('Autorización cancelada.')).toBeInTheDocument();
  });
  it('el sondeo no solapa peticiones mientras main espera', async () => {
    vi.useFakeTimers(); let finish!: (value: VoicePassiveSnapshot) => void;
    service.getStatus.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const hook = renderHook(() => useVoicePassivePanel());
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); }); expect(service.getStatus).toHaveBeenCalledOnce();
    await act(async () => { finish(snapshot()); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); }); expect(service.getStatus).toHaveBeenCalledTimes(2); hook.unmount();
  });
  it('un estado denegado retira la configuración mostrada', async () => {
    const hook = renderHook(() => useVoicePassivePanel());
    await act(async () => { await Promise.resolve(); }); expect(hook.result.current.config?.enabled).toBe(true);
    service.getStatus.mockResolvedValueOnce({ success: false, code: 'context_invalid' });
    await act(async () => { await hook.result.current.activateSession(); await Promise.resolve(); });
    expect(hook.result.current.status).toBeNull(); expect(hook.result.current.config).toBeNull();
  });
});
