import { describe, expect, it } from 'vitest';
import { StudioAssetUrls } from '../../services/studio-asset-urls';
import { emptyStudioState } from '../../shared/live-studio-domain';
describe('renovación de archivos firmados', () => {
  it('mantiene src durante eventos, renueva antes de caducar y elimina rutas retiradas', () => {
    const urls = new StudioAssetUrls();
    const snapshot = { session_id: 's', user_id: 'u', can_manage: true, title: 'Clase', server_time: '', state: emptyStudioState(), asset_urls: { video: 'https://storage.test/one' } };
    expect(urls.normalize(snapshot, 0).asset_urls.video).toBe(snapshot.asset_urls.video);
    const renewed = { ...snapshot, asset_urls: { video: 'https://storage.test/two' } };
    expect(urls.normalize(renewed, 30000).asset_urls.video).toBe(snapshot.asset_urls.video);
    expect(urls.normalize(renewed, 600001).asset_urls.video).toBe(renewed.asset_urls.video);
    urls.normalize({ ...snapshot, asset_urls: {} }, 600002);
    expect(urls.normalize(snapshot, 600003).asset_urls.video).toBe(snapshot.asset_urls.video);
  });
});
