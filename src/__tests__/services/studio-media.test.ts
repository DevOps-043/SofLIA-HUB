import { describe, expect, it, vi } from 'vitest';
import { StudioMedia } from '../../services/studio-media';

function stream() { const track = { stop: vi.fn(), addEventListener: vi.fn() }; return { track, value: { getTracks: () => [track] } as unknown as MediaStream }; }
describe('propiedad de fuentes del estudio', () => {
  it('abre dispositivos reales elegidos, reemplaza sin duplicar y cierra todas las pistas', async () => {
    const first = stream(), second = stream(), screen = stream();
    const devices = { getUserMedia: vi.fn().mockResolvedValueOnce(first.value).mockResolvedValueOnce(second.value), getDisplayMedia: vi.fn().mockResolvedValue(screen.value) } as unknown as MediaDevices;
    const media = new StudioMedia(devices, vi.fn());
    await media.start('mic', 'usb-real');
    expect(devices.getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: { exact: 'usb-real' } }, video: false });
    await media.start('mic', 'other'); expect(first.track.stop).toHaveBeenCalledOnce();
    await media.start('screen'); expect(devices.getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: false });
    media.close(); expect(second.track.stop).toHaveBeenCalledOnce(); expect(screen.track.stop).toHaveBeenCalledOnce(); expect(media.stream('mic')).toBeNull();
  });
  it('libera una concesión tardía tras salir y conserva la fuente ante un rechazo', async () => {
    const late = stream(); let finish!: (value: MediaStream) => void;
    const devices = { getUserMedia: vi.fn(() => new Promise<MediaStream>((resolve) => { finish = resolve; })) } as unknown as MediaDevices;
    const media = new StudioMedia(devices, vi.fn());
    const pending = media.start('camera'); media.close(); finish(late.value); await pending;
    expect(late.track.stop).toHaveBeenCalledOnce(); expect(media.stream('camera')).toBeNull();
    vi.mocked(devices.getUserMedia).mockRejectedValueOnce(new DOMException('Denegado', 'NotAllowedError'));
    await expect(media.start('mic')).rejects.toThrow('Denegado'); expect(media.stream('mic')).toBeNull();
  });
});
