import { describe, expect, it } from 'vitest';
import { BrowserTrackingRuleEngine, createTrackingRuleList, mitigateFingerprintingRequestHeaders, mitigateFingerprintingResponseHeaders, stripTrackingParameters } from '../integrated-browser/tracking-protection';

describe('protección contra rastreo', () => {
  it('verifica la lista y bloquea host y subdominios clasificados', () => {
    const engine = new BrowserTrackingRuleEngine();
    engine.install(createTrackingRuleList(1, [{ host: 'tracker.example', category: 'tracker' }]));
    expect(engine.evaluate('https://pixel.tracker.example/a')).toEqual({ blocked: true, category: 'tracker' });
    expect(engine.evaluate('https://example.com/')).toEqual({ blocked: false });
  });

  it('rechaza una lista alterada o un rollback de versión', () => {
    const engine = new BrowserTrackingRuleEngine();
    const list = createTrackingRuleList(2, [{ host: 'ads.example', category: 'advertising' }]);
    expect(() => engine.install({ ...list, checksum: '0'.repeat(64) })).toThrow(/integridad/);
    engine.install(list);
    expect(() => engine.install(list)).toThrow(/más reciente/);
  });

  it('retira parámetros conocidos sin borrar los funcionales', () => {
    const result = stripTrackingParameters('https://example.com/report?id=7&utm_source=mail&fbclid=x');
    expect(result.url).toBe('https://example.com/report?id=7');
    expect(result.removed).toEqual(['utm_source', 'fbclid']);
  });

  it('mitiga client hints de alta entropía sin tocar hints básicos', () => {
    const request = { 'Sec-CH-UA': '"Chromium"', 'Sec-CH-UA-Platform': '"Windows"', 'Sec-CH-UA-Full-Version': '152.0.1', 'Device-Memory': '8' };
    expect(mitigateFingerprintingRequestHeaders(request)).toEqual(['Sec-CH-UA-Full-Version', 'Device-Memory']);
    expect(request).toEqual({ 'Sec-CH-UA': '"Chromium"', 'Sec-CH-UA-Platform': '"Windows"' });
    const response = { 'Accept-CH': ['Sec-CH-UA-Full-Version'], 'Content-Type': ['text/html'] };
    expect(mitigateFingerprintingResponseHeaders(response)).toEqual(['Accept-CH']);
    expect(response).toEqual({ 'Content-Type': ['text/html'] });
  });
});
