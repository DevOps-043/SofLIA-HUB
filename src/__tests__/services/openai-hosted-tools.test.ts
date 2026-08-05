import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({ vectorStores: [] as string[] }));

vi.mock('../../config', () => ({
  OPENAI_API_KEY: 'test-openai-key',
  get OPENAI_VECTOR_STORE_IDS() { return estado.vectorStores; },
  MODELS: { PRIMARY: 'gemini-3.6-flash' },
  OPENAI_MODELS: { COMPUTER_USE: 'gpt-5.6-terra', COMMANDS: 'gpt-5.6-luna' },
  isOpenAIConfigured: () => true,
}));

const { buildHostedTools } = await import('../../services/openai-chat/hosted-tools');
const { resolveOpenAIReasoningEffort } = await import('../../services/openai-chat/reasoning');

describe('Herramientas hospedadas de OpenAI', () => {
  beforeEach(() => {
    estado.vectorStores = [];
  });

  it('HT-001: web_search se activa con grounding y razonamiento suficiente', () => {
    const tools = buildHostedTools({ useWebSearch: true, reasoningEffort: 'medium' });

    expect(tools).toContainEqual({ type: 'web_search' });
  });

  it('HT-002: web_search se omite sin razonamiento', () => {
    const tools = buildHostedTools({ useWebSearch: true, reasoningEffort: 'none' });

    expect(tools.some((tool) => tool.type === 'web_search')).toBe(false);
  });

  it('HT-003: file_search solo aparece con vector stores configurados', () => {
    expect(buildHostedTools({ useWebSearch: false }).some((t) => t.type === 'file_search')).toBe(false);

    estado.vectorStores = ['vs_123', 'vs_456'];
    const tools = buildHostedTools({ useWebSearch: false });

    expect(tools).toContainEqual({ type: 'file_search', vector_store_ids: ['vs_123', 'vs_456'] });
  });

  it('HT-004: nunca se ofrece la herramienta computer de OpenAI', () => {
    estado.vectorStores = ['vs_123'];

    // El actuador visual del producto es Gemini 3.6 Flash en el proceso main.
    // Ofrecer tambien la herramienta nativa haria que dos agentes condujeran
    // la pantalla a la vez.
    const tools = buildHostedTools({ useWebSearch: true, reasoningEffort: 'high' });

    expect(tools.some((tool) => tool.type === 'computer')).toBe(false);
  });

  it('HT-005: preferencias rápidas heredadas se elevan a low antes del payload OpenAI', () => {
    expect(resolveOpenAIReasoningEffort({ forced: 'none' })).toBe('low');
    expect(resolveOpenAIReasoningEffort({ selected: 'minimal' })).toBe('low');
    expect(resolveOpenAIReasoningEffort({ forced: 'xhigh' })).toBe('xhigh');
  });
});
