import { OPENAI_VECTOR_STORE_IDS } from '../../config';

/** web_search se omite en el modo sin razonamiento. */
const WEB_SEARCH_UNSUPPORTED_EFFORTS = new Set(['none']);

export interface HostedToolParams {
  useWebSearch: boolean;
  reasoningEffort?: string | null;
}

/**
 * Herramientas hospedadas por OpenAI: corren en su infraestructura, no hay que
 * ejecutarlas ni devolver resultados.
 *
 * A proposito NO se ofrece la herramienta `computer` de OpenAI. El actuador
 * visual del producto es Gemini 3.6 Flash en el proceso main (`use_computer` ->
 * `electron/desktop-agent/gemini-cu`), que es quien resuelve DPI, monitores con
 * origen negativo y coordenadas globales. Exponer las dos haria que el modelo
 * condujera la pantalla en paralelo con el agente.
 */
export function buildHostedTools(params: HostedToolParams): any[] {
  const tools: any[] = [];

  if (params.useWebSearch && !WEB_SEARCH_UNSUPPORTED_EFFORTS.has(params.reasoningEffort || '')) {
    tools.push({ type: 'web_search' });
  }

  // file_search es lo que la doc llama "retrieval": exige al menos un vector
  // store, asi que sin configuracion la herramienta simplemente no se ofrece.
  if (OPENAI_VECTOR_STORE_IDS.length > 0) {
    tools.push({ type: 'file_search', vector_store_ids: OPENAI_VECTOR_STORE_IDS });
  }

  return tools;
}
