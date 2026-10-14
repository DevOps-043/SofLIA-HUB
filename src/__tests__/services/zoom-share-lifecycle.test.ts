import { describe, expect, it, vi } from 'vitest';
import { manageZoomSharing } from '../../../packages/zoom-runtime/share-lifecycle';
function stream() { const track = new EventTarget() as EventTarget & { stop: ReturnType<typeof vi.fn> }; track.stop = vi.fn(); return { track, value: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream }; }
describe('ciclo de vida de compartir en Zoom', () => {
  it('detiene las pistas concedidas desde el dock y restaura la API al cerrar', async () => {
    const value = stream(); const original = vi.fn(async () => value.value); const changed = vi.fn();
    const devices = { getDisplayMedia: original } as unknown as MediaDevices;
    const sharing = manageZoomSharing(devices, changed); await devices.getDisplayMedia({ video: true });
    const consumerEnded = vi.fn(); value.track.addEventListener('ended', consumerEnded);
    expect(changed).toHaveBeenLastCalledWith(true); sharing.stop(); expect(value.track.stop).toHaveBeenCalledOnce(); expect(consumerEnded).toHaveBeenCalledOnce(); expect(changed).toHaveBeenLastCalledWith(false);
    sharing.dispose(); expect(devices.getDisplayMedia).toBe(original);
  });
  it('libera una pista que llega después de cancelar y refleja fin nativo', async () => {
    const late = stream(); let finish!: (value: MediaStream) => void; const changed = vi.fn();
    const devices = { getDisplayMedia: vi.fn(() => new Promise<MediaStream>((done) => { finish = done; })) } as unknown as MediaDevices;
    const sharing = manageZoomSharing(devices, changed); const pending = devices.getDisplayMedia({ video: true }); sharing.stop(); finish(late.value);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(late.track.stop).toHaveBeenCalledOnce();
    sharing.dispose();
    const active = stream(); const next = { getDisplayMedia: vi.fn(async () => active.value) } as unknown as MediaDevices;
    const managed = manageZoomSharing(next, changed); await next.getDisplayMedia({ video: true }); active.track.dispatchEvent(new Event('ended'));
    expect(changed).toHaveBeenLastCalledWith(false); managed.dispose();
  });
});
