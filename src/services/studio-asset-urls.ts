import type { StudioSnapshot } from '../shared/live-studio.contract';
/** Storage firma por 15 minutos; conservar la URL 10 evita recargar medios en cada evento. */
export class StudioAssetUrls {
  private entries = new Map<string, { url: string; until: number }>();
  normalize(snapshot: StudioSnapshot, now: number): StudioSnapshot {
    const asset_urls: Record<string, string> = {};
    for (const [path, url] of Object.entries(snapshot.asset_urls)) {
      const previous = this.entries.get(path);
      const entry = previous && previous.until > now ? previous : { url, until: now + 600000 };
      this.entries.set(path, entry); asset_urls[path] = entry.url;
    }
    for (const path of this.entries.keys()) if (!(path in asset_urls)) this.entries.delete(path);
    return { ...snapshot, asset_urls };
  }
  clear() { this.entries.clear(); }
}
