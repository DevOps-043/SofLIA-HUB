import { describe, expect, it, vi, beforeEach } from 'vitest';

const openAiMocks = vi.hoisted(() => ({ create: vi.fn() }));
const dispatch = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('../../services/openai-chat/client', () => ({
  getOpenAI: async () => ({ responses: { create: openAiMocks.create } }),
}));

vi.mock('../../services/gemini-chat/tool-dispatch', () => ({
  isKnownGeminiTool: () => true,
  executeGeminiToolCall: dispatch.execute,
}));

const { sendOpenAIMessageStream } = await import('../../services/openai-chat/send-message-stream');

/**
 * Un turno que construye una presentacion no es un turno de chat: escribe
 * varios archivos y cada iteracion reenvia todo lo hecho hasta entonces. Esta
 * suite cubre lo que hacia que ese turno muriera en vez de terminar.
 */

/** Respuesta con una llamada a herramienta y sin texto visible. */
function toolCallStream(name: string, args: Record<string, unknown>, callId = 'call-1') {
  return (async function* () {
    yield {
      type: 'response.output_item.done',
      item: { type: 'function_call', name, call_id: callId, arguments: JSON.stringify(args) },
    };
    yield { type: 'response.completed', response: { usage: { total_tokens: 10 } } };
  })();
}

function textStream(text: string) {
  return (async function* () {
    yield { type: 'response.output_text.delta', delta: text };
    yield { type: 'response.completed', response: { usage: { total_tokens: 10 } } };
  })();
}

type ItemReenviado = { type?: string; arguments?: string };

/** Localiza la llamada replicada en el `input` de la peticion numero `indice`. */
function llamadaReenviada(indice: number): ItemReenviado | undefined {
  const enviado = (openAiMocks.create.mock.calls[indice]?.[0]?.input ?? []) as ItemReenviado[];
  return enviado.find((item) => item?.type === 'function_call');
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of stream) out += chunk;
  return out;
}

function params(overrides: Record<string, unknown> = {}) {
  return {
    modelId: 'gpt-5.6-luna',
    finalMessage: 'genera la presentacion',
    systemInstruction: 'Eres SofLIA.',
    conversationHistory: [],
    useToolLoop: true,
    computerUseEnabled: false,
    useWebSearch: false,
    options: {
      activeSkill: {
        id: 'sistema:presentaciones',
        name: 'Presentaciones',
        instructions: 'Genera la presentacion.',
        tools: ['workspace_write_file', 'workspace_read_file'],
        workspaceId: 'ws-1',
      },
    },
    ...overrides,
  } as Parameters<typeof sendOpenAIMessageStream>[0];
}

describe('turno de OpenAI con espacio de trabajo', () => {
  beforeEach(() => {
    openAiMocks.create.mockReset();
    dispatch.execute.mockReset();
    dispatch.execute.mockResolvedValue({ functionResponse: { name: 'x', response: { success: true } } });
  });

  it('reintenta un 429 al abrir el stream en vez de matar el turno', async () => {
    // Antes el proveedor se llamaba a pelo: un limite por minuto —facil de
    // tocar aqui, donde cada iteracion reenvia el contexto entero— terminaba
    // el turno con "capacidad temporal" y la presentacion a medias.
    openAiMocks.create
      .mockRejectedValueOnce(new Error('[429] Rate limit reached for tokens per min'))
      .mockReturnValueOnce(textStream('Listo.'));

    const result = await sendOpenAIMessageStream(params());

    await expect(collect(result.stream)).resolves.toContain('Listo.');
    expect(openAiMocks.create).toHaveBeenCalledTimes(2);
  }, 20_000);

  it('reintenta un 429 que llega leyendo el stream, no al abrirlo', async () => {
    // Es el caso real: `create` resuelve bien y el limite por minuto aparece
    // consumiendo los eventos. Un reintento alrededor de la apertura no lo veia.
    const rotoAMitad = (async function* () {
      yield { type: 'response.created' };
      throw new Error('429 Rate limit reached ... Please try again in 1.049s');
    })();
    openAiMocks.create
      .mockReturnValueOnce(rotoAMitad)
      .mockReturnValueOnce(textStream('Presentacion lista.'));

    const result = await sendOpenAIMessageStream(params());

    await expect(collect(result.stream)).resolves.toContain('Presentacion lista.');
    expect(openAiMocks.create).toHaveBeenCalledTimes(2);
  }, 20_000);

  it('no reintenta si ya emitio texto en pantalla', async () => {
    const conTextoYFallo = (async function* () {
      yield { type: 'response.output_text.delta', delta: 'Voy a preparar la portada' };
      throw new Error('429 Rate limit reached');
    })();
    openAiMocks.create.mockReturnValueOnce(conTextoYFallo);

    const result = await sendOpenAIMessageStream(params());
    const texto = await collect(result.stream);

    // Repetir el intento reimprimiria lo ya escrito: se anexa el aviso.
    expect(texto).toContain('Voy a preparar la portada');
    expect(openAiMocks.create).toHaveBeenCalledTimes(1);
  });

  it('no reintenta un error que no es transitorio', async () => {
    openAiMocks.create.mockRejectedValue(new Error('invalid_request: unknown parameter'));

    const result = await sendOpenAIMessageStream(params());

    await expect(collect(result.stream)).rejects.toThrow(/invalid_request/);
    expect(openAiMocks.create).toHaveBeenCalledTimes(1);
  });

  it('deja de reenviar el contenido ya escrito en las iteraciones siguientes', async () => {
    const html = `<!doctype html>${'<section>diapositiva</section>'.repeat(400)}`;
    openAiMocks.create
      .mockReturnValueOnce(toolCallStream('workspace_write_file', { path: 'index.html', content: html }))
      .mockReturnValueOnce(textStream('Presentacion lista.'));

    const result = await sendOpenAIMessageStream(params());
    await collect(result.stream);

    const llamada = llamadaReenviada(1);
    expect(llamada).toBeTruthy();
    // La ruta sigue ahi —el modelo debe saber que escribio— pero el documento
    // entero ya no viaja otra vez en cada peticion.
    expect(llamada?.arguments).toContain('index.html');
    expect(llamada?.arguments).not.toContain('<section>diapositiva</section>');
    expect(llamada?.arguments).toContain('omitido del contexto');
  });

  it('conserva intactos los argumentos pequenos', async () => {
    openAiMocks.create
      .mockReturnValueOnce(toolCallStream('workspace_read_file', { path: 'index.html' }))
      .mockReturnValueOnce(textStream('Leido.'));

    const result = await sendOpenAIMessageStream(params());
    await collect(result.stream);

    expect(JSON.parse(llamadaReenviada(1)?.arguments ?? '{}')).toEqual({ path: 'index.html' });
  });

  it('adjunta la captura como imagen y no como texto en la salida de la herramienta', async () => {
    const png = `data:image/png;base64,${'A'.repeat(200_000)}`;
    dispatch.execute.mockResolvedValue({
      functionResponse: { name: 'take_screenshot', response: { success: true } },
      images: [png],
    });
    openAiMocks.create
      .mockReturnValueOnce(toolCallStream('take_screenshot', {}))
      .mockReturnValueOnce(textStream('Veo la pantalla.'));

    const result = await sendOpenAIMessageStream(params());
    await collect(result.stream);

    const enviado = (openAiMocks.create.mock.calls[1]?.[0]?.input ?? []) as Array<Record<string, unknown>>;
    const salida = enviado.find((item) => item?.type === 'function_call_output');
    const imagen = enviado.find(
      (item) => item?.role === 'user'
        && Array.isArray(item.content)
        && (item.content as Array<{ type?: string }>).some((parte) => parte?.type === 'input_image'),
    );

    // Base64 dentro del JSON de la salida es lo que pedia 399 008 tokens.
    expect(String(salida?.output)).not.toContain('AAAA');
    expect(imagen).toBeTruthy();
  });

  it('descarta las capturas antiguas y conserva las recientes', async () => {
    const png = (marca: string) => `data:image/png;base64,${marca.repeat(50)}`;
    let paso = 0;
    dispatch.execute.mockImplementation(async () => {
      paso += 1;
      return {
        functionResponse: { name: 'take_screenshot', response: { success: true, paso } },
        images: [png(String.fromCharCode(64 + paso))],
      };
    });
    openAiMocks.create.mockImplementation(() => toolCallStream('take_screenshot', {}));

    const result = await sendOpenAIMessageStream(params());
    await collect(result.stream);

    const llamadas = openAiMocks.create.mock.calls;
    const ultima = (llamadas[llamadas.length - 1]?.[0]?.input ?? []) as Array<Record<string, unknown>>;
    const vivas = ultima.filter(
      (item) => item?.role === 'user'
        && Array.isArray(item.content)
        && (item.content as Array<{ type?: string }>).some((parte) => parte?.type === 'input_image'),
    );

    // Una pantalla de hace ocho acciones ya no describe nada cierto, pero
    // seguiria pagando su costo en cada peticion del turno. El limite son tres
    // vivas al preparar cada peticion, mas la que se adjunta despues de la
    // ultima: lo que importa es que no crezca con las iteraciones.
    expect(paso).toBeGreaterThan(10);
    expect(vivas.length).toBeLessThanOrEqual(4);
    expect(ultima.some((item) => typeof item?.content === 'string' && item.content.includes('se descarto por antigua'))).toBe(true);
  }, 20_000);

  it('recorta los resultados de herramienta antiguos para que el turno quepa', async () => {
    // Lo que agotaba los 200 000 tokens por minuto: leer una pagina, descargar
    // un documento y listar carpetas deja resultados grandes que se reenviaban
    // integros en cada iteracion.
    const documento = 'contenido del documento '.repeat(20_000);
    dispatch.execute.mockResolvedValue({
      functionResponse: { name: 'read_file', response: { success: true, content: documento } },
    });
    openAiMocks.create.mockImplementation(() => toolCallStream('read_file', { path: 'informe.docx' }));

    const result = await sendOpenAIMessageStream(params());
    await collect(result.stream);

    const llamadas = openAiMocks.create.mock.calls;
    const ultima = (llamadas[llamadas.length - 1]?.[0]?.input ?? []) as Array<Record<string, unknown>>;
    const salidas = ultima.filter((item) => item?.type === 'function_call_output');
    const recortadas = salidas.filter((item) => String(item.output).includes('omitido para que el turno quepa'));
    const intactas = salidas.filter((item) => String(item.output).includes('contenido del documento'));

    expect(recortadas.length).toBeGreaterThan(0);
    // Los mas recientes son el material con el que el modelo trabaja ahora.
    expect(intactas.length).toBeLessThanOrEqual(4);
  }, 30_000);

  it('da mas iteraciones y mas salida al turno que construye archivos', async () => {
    openAiMocks.create.mockImplementation(() => toolCallStream('workspace_write_file', { path: 'a.html', content: 'x' }));

    const conWorkspace = await sendOpenAIMessageStream(params());
    await collect(conWorkspace.stream);
    const iteracionesConWorkspace = openAiMocks.create.mock.calls.length;
    const salidaConWorkspace = openAiMocks.create.mock.calls[0]?.[0]?.max_output_tokens;

    openAiMocks.create.mockClear();
    const sinWorkspace = await sendOpenAIMessageStream(params({ options: {} }));
    await collect(sinWorkspace.stream);

    // Escribir documento, estilos, guion e imagenes no cabe en el tope de un
    // turno de chat: se quedaba a medias y respondia como si hubiera acabado.
    expect(iteracionesConWorkspace).toBeGreaterThan(openAiMocks.create.mock.calls.length);
    expect(salidaConWorkspace).toBeGreaterThan(openAiMocks.create.mock.calls[0]?.[0]?.max_output_tokens);
  }, 20_000);
});
