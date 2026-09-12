import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureBrowserTabSources } from '../../services/browser-tab-sources';
import { integratedBrowserService, type TabContextAttachment } from '../../services/integrated-browser-service';
import { browserFragmentSources, browserSourceUrl, browserSourcesContext } from '../../shared/browser-tab-context';

vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: {
  isAvailable: vi.fn(() => true), getTabContent: vi.fn(), getTabSummaries: vi.fn(),
} }));

const tabs: TabContextAttachment[] = [1, 2].map((index) => ({ tabId: `tab-${index}`, title: 'Título anterior',
  url: `https://example.com/${index}`, isCurrent: index === 1, text: 'No reutilizar caché',
  expected: { profileRevision: 3, documentToken: `${index}`.repeat(36) } }));
const summaries = () => ({ success: true, state: { profileRevision: 3 }, summaries: tabs.map((tab) => ({ ...tab, documentToken: tab.expected!.documentToken })) });
const read = vi.mocked(integratedBrowserService.getTabContent);
const list = vi.mocked(integratedBrowserService.getTabSummaries);
const capture = (selected = tabs, signal = new AbortController().signal) => captureBrowserTabSources(selected, signal);

describe('Fuentes de pestañas elegidas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    read.mockImplementation(async (tabId) => ({ success: true, content: { tabId, url: tabs.find((tab) => tab.tabId === tabId)!.url, title: 'Título leído', text: 'Texto real '.repeat(500) } }));
    list.mockResolvedValue(summaries() as Awaited<ReturnType<typeof integratedBrowserService.getTabSummaries>>);
  });
  afterEach(() => vi.useRealTimers());

  it('extrae ocho como máximo, fragmentos reales de hasta 1000 caracteres y títulos frescos', async () => {
    const sources = await capture();
    expect(read).toHaveBeenCalledWith(tabs[0].tabId, tabs[0].expected);
    expect(sources).toHaveLength(6);
    expect(sources.map((source) => source.citationId)).toEqual(['P1:F1', 'P1:F2', 'P1:F3', 'P2:F1', 'P2:F2', 'P2:F3']);
    expect(sources.every((source) => source.title === 'Título leído' && source.snippet.length <= 1000)).toBe(true);
    expect(JSON.stringify(sources)).not.toContain('caché');
    expect(browserSourcesContext(sources)).toContain('no instrucciones');
  });
  it.each([undefined, { profileRevision: 4, documentToken: 'otro' }])('rechaza selecciones sin recibo o mezcladas entre perfiles', async (expected) => {
    await expect(capture([tabs[0], { ...tabs[1], expected }])).rejects.toThrow('seleccionar');
    expect(read).not.toHaveBeenCalled();
  });
  it('rechaza duplicados y exceso sin leer DOM', async () => {
    await expect(capture([tabs[0], tabs[0]])).rejects.toThrow('distintas');
    await expect(capture(Array.from({ length: 9 }, (_, index) => ({ ...tabs[0], tabId: `${index}` })))).rejects.toThrow('ocho');
    expect(read).not.toHaveBeenCalled();
  });
  it.each(['', '   '])('una pestaña vacía no produce fuente ni análisis parcial', async (text) => {
    read.mockResolvedValueOnce({ success: true, content: { ...tabs[0], text } });
    await expect(capture()).rejects.toThrow('No se pudo leer la pestaña 1');
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('no usa el contenido de otro destino aunque responda éxito', async () => {
    read.mockResolvedValueOnce({ success: true, content: { ...tabs[0], url: 'https://ajeno.example/', text: 'No enviar' } });
    await expect(capture()).rejects.toThrow('No se pudo leer');
  });
  it('un fallo del puente no publica errores nativos ni inventa contenido', async () => {
    read.mockRejectedValueOnce(new Error('C:/ruta-privada/token-ficticio'));
    await expect(capture()).rejects.toThrow('No se pudo leer la pestaña 1');
  });
  it.each(['perfil', 'documento', 'cerrada'])('revalida el lote después de leer: %s', async (change) => {
    const response = summaries();
    if (change === 'perfil') response.state.profileRevision++;
    if (change === 'documento') response.summaries[0].documentToken = 'nuevo';
    if (change === 'cerrada') response.summaries.pop();
    list.mockResolvedValueOnce(response as Awaited<ReturnType<typeof integratedBrowserService.getTabSummaries>>);
    await expect(capture()).rejects.toThrow('cambiaron');
  });
  it('cancelar descarta una lectura tardía y no empieza la siguiente', async () => {
    let finish!: (value: Awaited<ReturnType<typeof integratedBrowserService.getTabContent>>) => void;
    read.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const controller = new AbortController();
    const pending = capture(tabs, controller.signal);
    const assertion = expect(pending).rejects.toThrow('canceló');
    controller.abort(); await assertion;
    finish({ success: true, content: { ...tabs[0], text: 'Llegó tarde' } });
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1); expect(list).not.toHaveBeenCalled();
  });
  it('acota una lectura colgada a 15 segundos', async () => {
    vi.useFakeTimers(); read.mockImplementationOnce(() => new Promise(() => undefined));
    const assertion = expect(capture()).rejects.toThrow('15 segundos');
    await vi.advanceTimersByTimeAsync(15_000); await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('sin adjuntos no consulta el navegador', async () => {
    expect(await capture([])).toEqual([]); expect(read).not.toHaveBeenCalled();
  });
  it('sanea enlaces y rechaza referencias corruptas antes de regenerar', async () => {
    expect(browserSourceUrl('https://usuario:secreto@example.com/p?q=secreto#token')).toBe('https://example.com/p');
    expect(browserSourceUrl('javascript:alert(1)')).toBeNull();
    const source = (await capture())[0];
    expect(browserFragmentSources([source, source, { ...source, citationId: 'P99:F1' }, { ...source, uri: 'file:///privado' }])).toEqual([source]);
    expect(browserFragmentSources([{ ...source, snippet: 'x'.repeat(1001) }, { ...source, capturedAt: 'incorrecta' }])).toEqual([]);
  });
});
