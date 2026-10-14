/** Posee las pistas nativas del SDK; permite parar sin usar internals ni DOM de Zoom. */
export function manageZoomSharing(devices: MediaDevices, changed: (sharing: boolean) => void) {
  const original = devices.getDisplayMedia;
  let active: MediaStream | null = null;
  let generation = 0;
  const stopTracks = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((track) => {
      track.stop();
      // stop() no emite ended; se notifica a los consumidores para cerrar la emisión.
      track.dispatchEvent(new Event('ended'));
    });
  };
  const stop = () => {
    generation++;
    const stream = active; active = null;
    stopTracks(stream);
    changed(false);
  };
  const capture: MediaDevices['getDisplayMedia'] = async (constraints) => {
    const revision = ++generation;
    const stream = await original.call(devices, constraints);
    if (revision !== generation) { stream.getTracks().forEach((track) => track.stop()); throw new DOMException('La captura se canceló.', 'AbortError'); }
    const previous = active; active = null;
    stopTracks(previous);
    active = stream;
    stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => { if (active === stream) stop(); }, { once: true }));
    changed(true);
    return stream;
  };
  devices.getDisplayMedia = capture;
  return { stop, dispose: () => { stop(); if (devices.getDisplayMedia === capture) devices.getDisplayMedia = original; } };
}
