import { describe, expect, it, vi } from 'vitest';

const openAiMocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('../../services/openai-chat/client', () => ({
  getOpenAI: async () => ({ responses: { create: openAiMocks.create } }),
}));

// Esta suite cubre el canal visible, no la ejecucion de herramientas: el
// despachador real arrastra los servicios de datos del producto.
vi.mock('../../services/gemini-chat/tool-dispatch', () => ({
  isKnownGeminiTool: () => false,
  executeGeminiToolCall: vi.fn(),
}));

const { sendOpenAIMessageStream } = await import('../../services/openai-chat/send-message-stream');

/** Emite los deltas de texto que el proveedor entregaria en el canal visible. */
function responseStream(deltas: string[]) {
  return (async function* () {
    for (const delta of deltas) yield { type: 'response.output_text.delta', delta };
    yield { type: 'response.completed', response: { usage: { total_tokens: 10 } } };
  })();
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = '';
  for await (const chunk of stream) text += chunk;
  return text;
}

function params(overrides: Record<string, unknown> = {}) {
  return {
    modelId: 'gpt-5.6-luna',
    finalMessage: 'revisa Codex y avisa a Pedro',
    systemInstruction: 'Eres SofLIA.',
    conversationHistory: [],
    useToolLoop: true,
    computerUseEnabled: true,
    useWebSearch: false,
    ...overrides,
  } as Parameters<typeof sendOpenAIMessageStream>[0];
}

describe('canal visible de OpenAI', () => {
  it('OAS-001: no muestra el andamiaje de una llamada emitida como texto', async () => {
    // Reproduce el reporte: el modelo escribio la llamada en el canal visible
    // en vez de emitirla como item, repartida en varios deltas.
    openAiMocks.create.mockReturnValueOnce(responseStream([
      'Revisando ahora el estado visible de Codex.',
      '{"task":"Inspecciona la pantalla y local',
      'iza la ventana de Codex.","backend":"computer"}',
      '<|assistant to=use_com',
      'puter code|>',
      '{"task":"Inspecciona la pantalla y localiza la ventana de Codex."}',
      'No puedo verificar todavía qué corrigió Codex.',
    ]));

    const result = await sendOpenAIMessageStream(params());
    const text = await collect(result.stream);

    expect(text).toBe('Revisando ahora el estado visible de Codex.No puedo verificar todavía qué corrigió Codex.');
    expect(text).not.toContain('<|');
    expect(text).not.toContain('"backend"');
  });

  it('OAS-002: un turno que solo trae andamiaje no deja la burbuja vacía', async () => {
    openAiMocks.create.mockReturnValueOnce(responseStream([
      '<|channel|>commentary<|message|>',
      '{"task":"Inspecciona la pantalla."}',
    ]));

    const result = await sendOpenAIMessageStream(params());
    const text = await collect(result.stream);

    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toContain('<|');
    expect(text).toContain('No obtuve una respuesta utilizable');
  });

  it('OAS-003: el texto legítimo llega intacto', async () => {
    openAiMocks.create.mockReturnValueOnce(responseStream([
      'Configura el cliente con ',
      '```json\n{"task":"ejemplo","backend":"desktop"}\n```',
      ' y listo.',
    ]));

    const result = await sendOpenAIMessageStream(params());

    await expect(collect(result.stream)).resolves.toBe(
      'Configura el cliente con ```json\n{"task":"ejemplo","backend":"desktop"}\n``` y listo.',
    );
  });
});
