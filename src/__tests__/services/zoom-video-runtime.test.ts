import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  client: { init: vi.fn(), join: vi.fn(), leave: vi.fn(), on: vi.fn(), getMediaStream: vi.fn(), getAllUser: vi.fn(), getCurrentUserInfo: vi.fn(), getRecordingClient: vi.fn() },
  stream: { startAudio: vi.fn(), muteAudio: vi.fn(), unmuteAudio: vi.fn(), startVideo: vi.fn(), stopVideo: vi.fn(), startShareScreen: vi.fn(), stopShareScreen: vi.fn(), isStartShareScreenWithVideoElement: vi.fn() },
  destroy: vi.fn(),
}));
vi.mock('../../../packages/zoom-runtime/video-client', () => ({ ZoomVideo: { createClient: () => sdk.client, destroyClient: sdk.destroy }, VideoQuality: { Video_360P: 2 } }));
import { start } from '../../../packages/zoom-runtime/video-runtime';
const origin = location.origin;
const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
function launch() {
  start(new MessageEvent('message', { origin, source: window, data: { detail: { provider: 'zoom-video', sessionName: 'aula', token: 'jwt', userName: 'Ana', password: '123456', recording_required: true } } }));
}
function command(type: string, detail?: unknown, source: MessageEventSource | null = window, from = origin) {
  window.dispatchEvent(new MessageEvent('message', { source, origin: from, data: { source: 'soflia-studio', nonce: 'video-prueba', type, detail } }));
}
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks(); location.hash = 'video-prueba';
  document.body.innerHTML = '<div id="status"></div><div id="meeting"></div>';
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn() } });
  sdk.client.init.mockResolvedValue(''); sdk.client.join.mockResolvedValue(''); sdk.client.leave.mockResolvedValue('');
  sdk.client.getMediaStream.mockReturnValue(sdk.stream); sdk.client.getAllUser.mockReturnValue([]);
  sdk.client.getCurrentUserInfo.mockReturnValue({ muted: true, bVideoOn: false });
  sdk.client.getRecordingClient.mockReturnValue({ getCloudRecordingStatus: () => 'Recording' });
  sdk.stream.startAudio.mockResolvedValue(''); sdk.stream.startVideo.mockResolvedValue('');
  sdk.stream.isStartShareScreenWithVideoElement.mockReturnValue(true);
  sdk.destroy.mockResolvedValue(undefined);
});
afterEach(async () => { command('leave'); await flush(); vi.useRealTimers(); });
describe('ciclo de vida del adaptador Video SDK', () => {
  it('espera una unión pendiente antes de liberar el cliente, sin informar conexión tras salir', async () => {
    let resolve!: () => void;
    sdk.client.join.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const post = vi.spyOn(window, 'postMessage'); launch(); await flush(); command('leave'); await flush();
    expect(sdk.destroy).not.toHaveBeenCalled(); resolve(); await flush();
    expect(sdk.client.leave).toHaveBeenCalledOnce(); expect(sdk.destroy).toHaveBeenCalledOnce();
    expect(post.mock.calls.some(([message]) => message.type === 'connected')).toBe(false);
  });
  it('solo acepta comandos del origen del padre y libera una sola vez', async () => {
    launch(); await flush(); command('leave', undefined, window, 'https://otro.test'); await flush();
    expect(sdk.destroy).not.toHaveBeenCalled(); command('leave'); command('leave'); await flush();
    expect(sdk.destroy).toHaveBeenCalledOnce();
  });
  it('reconoce errores resueltos por el SDK y conserva apagada la cámara', async () => {
    const post = vi.spyOn(window, 'postMessage'); launch(); await flush();
    sdk.stream.startVideo.mockResolvedValue({ type: 'INSUFFICIENT_PRIVILEGES', reason: 'prueba' });
    const camera = [...document.querySelectorAll('button')].find(button => button.textContent === 'Activar cámara')!;
    camera.click(); await flush(); expect(camera.textContent).toBe('Activar cámara');
    expect(post.mock.calls.some(([message]) => message.type === 'action-error')).toBe(true);
  });
  it('no emite connected cuando falla la inicialización', async () => {
    sdk.client.init.mockResolvedValue({ type: 'INVALID_OPERATION' }); const post = vi.spyOn(window, 'postMessage');
    launch(); await flush(); expect(sdk.client.join).not.toHaveBeenCalled(); expect(sdk.destroy).toHaveBeenCalledOnce();
    expect(post.mock.calls.some(([message]) => message.type === 'error')).toBe(true);
  });
});
