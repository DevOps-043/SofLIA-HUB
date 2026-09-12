import { integratedBrowserService, type TabContextAttachment, type BrowserTabContentResponse, type IntegratedBrowserTabSummariesResponse } from './integrated-browser-service';
import { BROWSER_SOURCE_LIMITS, browserSourceUrl, browserSourcesContext, type BrowserFragmentSource } from '../shared/browser-tab-context';

/** Todas las pestañas deben leerse: nunca enviar un análisis silenciosamente parcial. */
export async function captureBrowserTabSources(tabs: TabContextAttachment[], signal: AbortSignal): Promise<BrowserFragmentSource[]> {
  if (!tabs.length) return [];
  if (tabs.length > BROWSER_SOURCE_LIMITS.tabs || new Set(tabs.map((tab) => tab.tabId)).size !== tabs.length) {
    throw new Error('Selecciona hasta ocho pestañas distintas.');
  }
  const profile = tabs[0].expected?.profileRevision;
  if (!integratedBrowserService.isAvailable() || profile === undefined
    || tabs.some((tab) => !tab.expected?.documentToken || tab.expected.profileRevision !== profile || !browserSourceUrl(tab.url))) {
    throw new Error('Vuelve a seleccionar las pestañas disponibles del perfil actual.');
  }
  let expired = false;
  const check = () => {
    if (signal.aborted || expired) throw new Error('Se canceló la preparación de pestañas.');
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => undefined;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('Se canceló la preparación de pestañas.'));
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      expired = true;
      reject(new Error('La lectura de pestañas superó 15 segundos. Revisa los permisos o vuelve a intentarlo.'));
    }, BROWSER_SOURCE_LIMITS.timeoutMs);
  });
  const capture = async (): Promise<BrowserFragmentSource[]> => {
    const sources: BrowserFragmentSource[] = [];
    for (const [index, tab] of tabs.entries()) {
      check();
      const response = await integratedBrowserService.getTabContent(tab.tabId, tab.expected).catch((): BrowserTabContentResponse => ({ success: false }));
      check();
      const content = response.content;
      if (!response.success || !content || content.tabId !== tab.tabId || content.url !== tab.url || !content.text.trim()) {
        throw new Error(`No se pudo leer la pestaña ${index + 1}. Vuelve a seleccionarla o quítala del mensaje.`);
      }
      const uri = browserSourceUrl(content.url);
      if (!uri) throw new Error('La pestaña no admite una fuente web verificable.');
      const capturedAt = new Date().toISOString();
      for (let part = 0; part < BROWSER_SOURCE_LIMITS.fragmentsPerTab; part++) {
        const snippet = content.text.slice(part * BROWSER_SOURCE_LIMITS.fragmentChars, (part + 1) * BROWSER_SOURCE_LIMITS.fragmentChars).trim();
        if (snippet) sources.push({ kind: 'browser', uri, title: content.title.slice(0, 200), snippet,
          citationId: `P${index + 1}:F${part + 1}`, capturedAt });
      }
      if (!sources.some((source) => source.citationId.startsWith(`P${index + 1}:`))) {
        throw new Error(`La pestaña ${index + 1} no contiene un extracto utilizable.`);
      }
    }
    // Revalidar el lote: una navegación mientras se leía otra pestaña invalida todo.
    if (browserSourcesContext(sources).length > 60_000) throw new Error('Los extractos exceden el presupuesto del turno. Selecciona menos pestañas.');
    const latest = await integratedBrowserService.getTabSummaries().catch((): IntegratedBrowserTabSummariesResponse => ({ success: false }));
    check();
    if (!latest.success || latest.state?.profileRevision !== profile || tabs.some((tab) => !latest.summaries?.some(
      (summary) => summary.tabId === tab.tabId && summary.documentToken === tab.expected?.documentToken && summary.url === tab.url,
    ))) throw new Error('Las pestañas o el perfil cambiaron durante la lectura. Selecciónalas de nuevo.');
    return sources;
  };
  try { return await Promise.race([capture(), interrupted]); }
  finally { if (timer) clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
}
