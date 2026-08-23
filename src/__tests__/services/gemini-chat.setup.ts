import { vi } from 'vitest';

const geminiChatMocks = vi.hoisted(() => {
  const mockGetGenerativeModel = vi.fn();
  const mockChatsCreate = vi.fn();
  return {
    mockGetGenerativeModel,
    // El chat crea la sesion con `chats.create` de @google/genai.
    mockChatsCreate,
    mockGoogleGenAI: vi.fn().mockImplementation(function () {
      return { chats: { create: mockChatsCreate } };
    }),
    mockGoogleGenerativeAI: vi.fn().mockImplementation(function () {
      return { getGenerativeModel: mockGetGenerativeModel };
    }),
    mockGetApiKeyWithCache: vi.fn(async () => null),
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: geminiChatMocks.mockGoogleGenAI,
}));

// El SDK legado sigue en uso para los turnos de un solo disparo (optimizador de
// prompts); se mockea para que ninguna prueba construya el cliente real.
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: geminiChatMocks.mockGoogleGenerativeAI,
  HarmBlockThreshold: { BLOCK_NONE: 'BLOCK_NONE' },
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
}));

vi.mock('../../services/api-keys', () => ({
  getApiKeyWithCache: geminiChatMocks.mockGetApiKeyWithCache,
}));

vi.mock('../../config', () => ({
  GOOGLE_API_KEY: 'env-test-key',
  OPENAI_API_KEY: '',
  MODELS: {
    PRIMARY: 'gemini-3.6-flash',
    FALLBACK: 'gemini-3.6-flash',
    PRO: 'gemini-3.6-flash',
    WEB_AGENT: 'gemini-3.6-flash',
    VISION: 'gemini-3.6-flash',
    THINKING: 'gemini-3.6-flash',
  },
  OPENAI_MODELS: {
    COMPUTER_USE: 'gpt-5.6-terra',
    COMMANDS: 'gpt-5.6-luna',
  },
  // Sin llave de OpenAI: esta suite cubre el pipeline de Gemini.
  isOpenAIConfigured: () => false,
}));

vi.mock('../../prompts/chat', () => ({
  PRIMARY_CHAT_PROMPT: 'Eres SofLIA, asistente de negocios.',
  buildPrimaryChatPrompt: vi.fn(() => 'Eres SofLIA, asistente de negocios.'),
}));

vi.mock('../../services/gemini-tools', () => ({
  COMPUTER_USE_TOOLS: {
    functionDeclarations: [
      { name: 'list_directory', description: 'test', parameters: {} },
      { name: 'create_word_document', description: 'test', parameters: {} },
      { name: 'use_computer', description: 'test', parameters: {} },
    ],
  },
  COMPUTER_TOOL_NAMES: new Set(['list_directory', 'create_word_document', 'use_computer']),
  PROJECT_HUB_TOOLS: { functionDeclarations: [] },
  PROJECT_HUB_TOOL_NAMES: new Set(),
  GOOGLE_WORKSPACE_TOOLS: { functionDeclarations: [] },
  GOOGLE_WORKSPACE_TOOL_NAMES: new Set(),
  INTEGRATED_BROWSER_TOOLS: {
    functionDeclarations: [
      { name: 'read_active_document', description: 'test', parameters: {} },
      { name: 'read_browser_dom', description: 'test', parameters: {} },
      { name: 'navigate_integrated_browser', description: 'test', parameters: {} },
    ],
  },
  INTEGRATED_BROWSER_TOOL_NAMES: new Set(['read_active_document', 'read_browser_dom', 'navigate_integrated_browser']),
  NATIVE_AI_TOOLS: { functionDeclarations: [] },
  NATIVE_AI_TOOL_NAMES: new Set(),
}));

vi.mock('../../services/computer-use-service', () => ({
  executeComputerTool: vi.fn(async () => '{}'),
  isComputerUseAvailable: vi.fn(() => true),
}));

vi.mock('../../services/iris-data', () => ({
  createProject: vi.fn(async () => ({ success: true })),
  deleteProject: vi.fn(async () => ({ success: true })),
  getProjects: vi.fn(async () => []),
  getTeamMembersDetailed: vi.fn(async () => []),
  getTeams: vi.fn(async () => []),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  isSupabaseConfigured: vi.fn(() => true),
}));

/**
 * `@google/genai` devuelve la respuesta directa, sin el envoltorio `{ response }`
 * que usaba el SDK legado.
 */
export function createMockChat(text: string) {
  const response = {
    text,
    candidates: [{ groundingMetadata: null, content: { parts: [{ text }] } }],
  };
  return {
    sendMessage: vi.fn(async () => response),
  };
}

export function getGeminiChatMocks() {
  return geminiChatMocks;
}
