import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { pickDisplayMediaSource, type DisplayMediaSelection } from '../integrated-browser/display-media-picker';
import type { StudioCaptureBinding } from '../../src/shared/studio-capture';

export const MAX_STUDIO_CAPTURE_BINDINGS = 14;
const PREVIEW_GRANT_MS = 10_000;
export class StudioCaptureService {
  private bindings = new Map<string, { metadata: StudioCaptureBinding; selection: DisplayMediaSelection }>();
  private activeId: string | null = null;
  private preview: { id: string; expires: number } | null = null;
  private generation = 0;
  private activation = 0;
  private choosing = false;
  constructor(private parent: BrowserWindow) {}
  clear(): void { this.generation++; this.activation++; this.bindings.clear(); this.activeId = null; this.preview = null; }
  async choose(isCurrent: () => boolean): Promise<StudioCaptureBinding | null> {
    if (this.choosing) throw new Error('Ya hay una selección de fuente abierta.');
    if (this.bindings.size >= MAX_STUDIO_CAPTURE_BINDINGS) throw new Error('Quita una fuente antes de vincular otra.');
    const generation = this.generation;
    this.choosing = true;
    try {
      const selection = await pickDisplayMediaSource({ parentWindow: this.parent, audioRequested: true, purpose: 'bind', isRequestCurrent: () => generation === this.generation && isCurrent() });
      if (!selection || generation !== this.generation || !isCurrent()) return null;
      const metadata: StudioCaptureBinding = { id: randomUUID(), name: selection.choice.preview.name, kind: selection.choice.preview.kind, thumbnail: selection.choice.preview.thumbnail, withSystemAudio: selection.withSystemAudio };
      this.bindings.set(metadata.id, { metadata, selection });
      return metadata;
    } finally { this.choosing = false; }
  }
  async activate(id: string | null, preview: boolean): Promise<void> {
    const activation = ++this.activation;
    if (id === null) { this.activeId = null; this.preview = null; return; }
    const generation = this.generation;
    const entry = this.bindings.get(id);
    if (!entry || !await entry.selection.choice.resolve(true) || generation !== this.generation || activation !== this.activation || this.bindings.get(id) !== entry) throw new Error('La fuente vinculada ya no está disponible. Vuelve a vincularla.');
    this.activeId = id;
    this.preview = preview ? { id, expires: Date.now() + PREVIEW_GRANT_MS } : null;
  }
  release(id: string): void {
    if (!this.bindings.delete(id)) return;
    if (this.activeId === id) this.activeId = null;
    if (this.preview?.id === id) this.preview = null;
  }
  async forRequest(preview: boolean): Promise<{ bound: false } | { bound: true; selection: Omit<DisplayMediaSelection, 'choice'> | null }> {
    const id = preview ? this.preview && this.preview.expires >= Date.now() ? this.preview.id : null : this.activeId;
    if (preview) this.preview = null;
    if (!id) return { bound: false };
    const generation = this.generation;
    const activation = this.activation;
    const entry = this.bindings.get(id);
    if (!entry) return { bound: true, selection: null };
    const video = await entry.selection.choice.resolve(true);
    return { bound: true, selection: video && generation === this.generation && activation === this.activation && this.activeId === id && this.bindings.get(id) === entry ? { video, withSystemAudio: entry.metadata.withSystemAudio } : null };
  }
}
