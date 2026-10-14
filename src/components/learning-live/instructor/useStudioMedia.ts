import { useCallback, useEffect, useRef, useState } from 'react';
import { StudioMedia, type MediaSource } from '../../../services/studio-media';
import { studioCapture } from '../../../services/studio-capture';

export function useStudioMedia() {
  const [streams, setStreams] = useState<{ mic: MediaStream | null; camera: MediaStream | null; screen: MediaStream | null }>({ mic: null, camera: null, screen: null });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState(() => navigator.mediaDevices ? '' : 'Este entorno no permite acceder a dispositivos.');
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState('default');
  const [cameraId, setCameraId] = useState('default');
  const controller = useRef<StudioMedia | null>(null);
  const alive = useRef(true);
  const capturing = useRef(false);
  const stop = useCallback(() => controller.current?.close(), []);
  const refreshDevices = useCallback(async () => {
    try { const found = await navigator.mediaDevices?.enumerateDevices(); if (alive.current) setDevices(found ?? []); }
    catch { if (alive.current) setError('No pudimos consultar los dispositivos del sistema.'); }
  }, []);
  useEffect(() => {
    alive.current = true;
    const api = navigator.mediaDevices;
    if (!api) return;
    controller.current = new StudioMedia(api, () => { if (alive.current) setStreams({ mic: controller.current?.stream('mic') ?? null, camera: controller.current?.stream('camera') ?? null, screen: controller.current?.stream('screen') ?? null }); });
    void api.enumerateDevices().then((found) => { if (alive.current) setDevices(found); }).catch(() => { if (alive.current) setError('No pudimos consultar los dispositivos del sistema.'); });
    api.addEventListener?.('devicechange', refreshDevices);
    return () => { alive.current = false; controller.current?.close(); controller.current = null; api.removeEventListener?.('devicechange', refreshDevices); };
  }, [refreshDevices]);
  async function toggle(source: MediaSource) {
    const media = controller.current;
    if (!media || pending) return;
    if (media.stream(source)) { media.stop(source); return; }
    setPending(true); setError('');
    try { await media.start(source, source === 'mic' ? input : source === 'camera' ? cameraId : undefined); await refreshDevices(); }
    catch (cause) { if (alive.current) setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Permiso denegado o selección cancelada. Puedes intentarlo de nuevo.' : 'No se pudo abrir la fuente. Revisa permisos y si otra aplicación usa el dispositivo.'); }
    finally { if (alive.current) setPending(false); }
  }
  async function selectInput(id: string) { if (controller.current?.stream('mic')) { try { await controller.current.start('mic', id); } catch { setError('No pudimos cambiar el micrófono. Se conserva la entrada anterior.'); return; } } setInput(id); }
  async function selectCamera(id: string) { if (controller.current?.stream('camera')) { try { await controller.current.start('camera', id); } catch { setError('No pudimos cambiar la cámara. Se conserva la cámara anterior.'); return; } } setCameraId(id); }
  async function shareBinding(id: string): Promise<boolean> {
    const media = controller.current;
    if (!media || capturing.current) return false;
    capturing.current = true; setPending(true); setError('');
    try {
      await studioCapture.activate(id, true);
      if (!alive.current || controller.current !== media) return false;
      await media.start('screen');
      return alive.current && controller.current === media && !!media.stream('screen');
    } catch { if (alive.current) setError('La fuente ligada no está disponible. Vuelve a vincularla y revisa los permisos de captura.'); return false; }
    finally { capturing.current = false; if (alive.current) setPending(false); }
  }
  const stopScreen = useCallback(() => controller.current?.stop('screen'), []);
  return { ...streams, toggle, devices, input, cameraId, selectInput, selectCamera, refreshDevices, error, pending, stop, shareBinding, stopScreen };
}
