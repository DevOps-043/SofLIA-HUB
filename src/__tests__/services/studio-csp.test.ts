import { describe, expect, it } from 'vitest';
import { injectCSP } from '../../../electron/preload/security';
describe('CSP del estudio embebido', () => {
  it('permite únicamente el frame SDK local y videos firmados del bucket académico', () => {
    injectCSP(); document.dispatchEvent(new Event('DOMContentLoaded'));
    const csp = document.head.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content');
    expect(csp).toContain('soflia-zoom://meeting');
    expect(csp).toContain("media-src 'self' data: blob: https://*.supabase.co/storage/v1/object/sign/live-studio-assets/");
    expect(csp).not.toContain('frame-src *');
  });
});
