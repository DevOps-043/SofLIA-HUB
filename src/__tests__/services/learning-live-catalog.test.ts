import { afterEach, describe, expect, it, vi } from 'vitest';
import { learningLiveService } from '../../services/learning-live-service';
const input = { organization_slug: 'acme', page: 0 };
afterEach(() => { delete window.learningLive; });
describe('wrapper de agenda Learning', () => {
  it('degrada de forma explícita en clientes que no exponen catálogo', async () => {
    expect(await learningLiveService.catalog(input)).toMatchObject({ success: false, code: 'unavailable' });
  });
  it('rechaza metadatos privados o respuestas incompatibles', async () => {
    window.learningLive = { catalog: vi.fn().mockResolvedValue({ success: true, catalog: { version: 1, user_id: '00000000-0000-4000-8000-000000000013', can_teach: false, total: 0, sessions: [], join_url: 'private' } }) } as unknown as NonNullable<Window['learningLive']>;
    expect(await learningLiveService.catalog(input)).toMatchObject({ success: false, error: 'Learning devolvió una agenda incompatible.' });
  });
});
