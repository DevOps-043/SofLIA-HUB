export type MediaSource = 'mic' | 'camera' | 'screen';
/** Un dueño por fuente; nunca deja pistas vivas después de cancelar o salir. */
export class StudioMedia {
  private streams = new Map<MediaSource, MediaStream>();
  private generations = new Map<MediaSource, number>();
  constructor(private devices: MediaDevices, private changed: () => void) {}
  stream(source: MediaSource) { return this.streams.get(source) ?? null; }
  async start(source: MediaSource, deviceId?: string) {
    const generation = (this.generations.get(source) ?? 0) + 1;
    this.generations.set(source, generation);
    const selection = deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : true;
    const stream = source === 'screen' ? await this.devices.getDisplayMedia({ video: true, audio: false }) : await this.devices.getUserMedia(source === 'mic' ? { audio: selection, video: false } : { video: selection, audio: false });
    if (this.generations.get(source) !== generation) { stream.getTracks().forEach((track) => track.stop()); return; }
    this.stopTracks(source); this.streams.set(source, stream);
    for (const track of stream.getTracks()) track.addEventListener('ended', () => { if (this.streams.get(source) === stream) this.stop(source); }, { once: true });
    this.changed();
  }
  private stopTracks(source: MediaSource) { this.streams.get(source)?.getTracks().forEach((track) => track.stop()); this.streams.delete(source); }
  stop(source: MediaSource) { this.generations.set(source, (this.generations.get(source) ?? 0) + 1); this.stopTracks(source); this.changed(); }
  close() { for (const source of ['mic', 'camera', 'screen'] as const) this.stop(source); }
}
