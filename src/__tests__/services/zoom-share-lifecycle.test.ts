import { describe, expect, it, vi } from 'vitest';
import { manageZoomSharing } from '../../../packages/zoom-runtime/share-lifecycle';
function stream() { const track = new EventTarget() as EventTarget & { stop: ReturnType<typeof vi.fn> }; track.stop = vi.fn(); return { track, value: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream }; }
describe('ciclo de vida de compartir en Zoom', () => {
  it('espera audio anunciado y no entrega una emisión incompleta antes de terminar la negociación',async()=>{
    const video=Object.assign(new EventTarget(),{kind:'video',stop:vi.fn()}),clone=Object.assign(new EventTarget(),{kind:'audio',stop:vi.fn()});
    const originalAudio={readyState:'live',stop:vi.fn(),clone:()=>clone};
    const tracks:unknown[]=[video];
    const value={getTracks:()=>tracks,getVideoTracks:()=>[video],getAudioTracks:()=>tracks.filter(track=>track===clone),addTrack:(track:unknown)=>tracks.push(track),removeTrack:vi.fn()} as unknown as MediaStream;
    let ready!:(track:MediaStreamTrack)=>void;
    const audio=new Promise<MediaStreamTrack>(resolve=>{ready=resolve;});
    const changed=vi.fn(),devices={getDisplayMedia:async()=>value} as unknown as MediaDevices;
    const sharing=manageZoomSharing(devices,changed,()=>audio);
    let delivered=false;
    const capture=devices.getDisplayMedia({video:true,audio:true}).then(stream=>{delivered=true;return stream;});
    await Promise.resolve();await Promise.resolve();expect(delivered).toBe(false);expect(changed).not.toHaveBeenCalledWith(true);
    ready(originalAudio as unknown as MediaStreamTrack);
    expect((await capture).getAudioTracks()).toEqual([clone]);sharing.stop();
    expect(clone.stop).toHaveBeenCalled();expect(originalAudio.stop).not.toHaveBeenCalled();
  });
  it('libera video pendiente al cancelar y rechaza una preparación de audio fallida',async()=>{
    const value=stream();let reject!:(error:Error)=>void;
    const audio=new Promise<MediaStreamTrack>((_,fail)=>{reject=fail;});
    const devices={getDisplayMedia:async()=>value.value} as unknown as MediaDevices;
    const sharing=manageZoomSharing(devices,()=>{},()=>audio),pending=devices.getDisplayMedia({video:true});
    await Promise.resolve();sharing.stop();expect(value.track.stop).toHaveBeenCalled();
    reject(new Error('Audio no preparado'));
    await expect(pending).rejects.toThrow('Audio no preparado');
  });
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
