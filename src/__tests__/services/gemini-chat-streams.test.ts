import { describe, expect, it, vi } from 'vitest';
import { buildStreamingResult, collectStreamText } from '../../services/gemini-chat/streams';

/**
 * `@google/genai` expone `text` y `functionCalls` como descriptores de acceso,
 * no como metodos. El SDK anterior los exponia como metodos, asi que el codigo
 * migrado que conserve `chunk.text()` lanza `TypeError` en tiempo de ejecucion
 * y una comprobacion de verdad sobre la funcion siempre da verdadero. Estas
 * pruebas fijan la forma nueva para que esa regresion falle aqui y no en un
 * turno real del usuario.
 */

type Chunk = {
  text?: string;
  functionCalls?: unknown[];
  candidates?: Array<Record<string, unknown>>;
};

function generadorDeChunks(chunks: Chunk[], onFinally?: () => void): AsyncGenerator<any> {
  return (async function* () {
    try {
      for (const chunk of chunks) yield chunk;
    } finally {
      onFinally?.();
    }
  })();
}

/** Chunk que estalla si alguien invoca `text` como funcion. */
function chunkConAccesorEstricto(texto: string): Chunk {
  const chunk: Chunk = {};
  Object.defineProperty(chunk, 'text', {
    get: () => texto,
    enumerable: true,
  });
  return chunk;
}

describe('streams del SDK @google/genai', () => {
  it('STREAM-001: lee el texto del chunk como descriptor de acceso', async () => {
    const resultado = await buildStreamingResult(
      generadorDeChunks([chunkConAccesorEstricto('Hola '), chunkConAccesorEstricto('mundo')]),
      [],
    );

    expect(await collectStreamText(resultado.stream)).toBe('Hola mundo');
  });

  it('STREAM-002: no invoca `text` como funcion', async () => {
    // Un `text` de tipo funcion es exactamente lo que devolvia el SDK anterior.
    // Si el codigo migrado lo llamara, el valor emitido seria el retorno de la
    // funcion; aqui la funcion falla, asi que la unica forma de pasar es NO
    // invocarla.
    const explota = vi.fn(() => {
      throw new Error('`text` se invoco como funcion: el SDK nuevo lo expone como propiedad.');
    });
    const resultado = await buildStreamingResult(generadorDeChunks([{ text: explota as any }]), []);

    await collectStreamText(resultado.stream);
    expect(explota).not.toHaveBeenCalled();
  });

  it('STREAM-003: ignora chunks sin texto sin romper el stream', async () => {
    const resultado = await buildStreamingResult(
      generadorDeChunks([{ text: 'uno' }, {}, { text: '' }, { text: 'dos' }]),
      [],
    );

    expect(await collectStreamText(resultado.stream)).toBe('unodos');
  });

  it('STREAM-004: resuelve las fuentes con el ultimo chunk que trae grounding', async () => {
    const resultado = await buildStreamingResult(
      generadorDeChunks([
        { text: 'parcial' },
        {
          text: ' final',
          candidates: [{
            groundingMetadata: {
              groundingChunks: [{ web: { uri: 'https://ejemplo.test/a', title: 'Ejemplo' } }],
            },
          }],
        },
      ]),
      [],
    );

    await collectStreamText(resultado.stream);
    expect(await resultado.sources).toEqual([
      { uri: 'https://ejemplo.test/a', title: 'Ejemplo', snippet: '' },
    ]);
  });

  it('STREAM-005: resuelve las fuentes aunque el consumidor abandone el stream', async () => {
    // El usuario cancela: `process-message` sale del `for await` con `break`,
    // lo que invoca `return()` sobre el generador. Sin resolver la promesa en
    // ese camino, un `await result.sources` posterior colgaria el turno.
    const resultado = await buildStreamingResult(
      generadorDeChunks([{ text: 'uno' }, { text: 'dos' }, { text: 'tres' }]),
      [],
    );

    for await (const chunk of resultado.stream) {
      expect(chunk).toBe('uno');
      break;
    }

    await expect(resultado.sources).resolves.toBeNull();
  });

  it('STREAM-006: resuelve las fuentes como nulas cuando el stream falla', async () => {
    const resultado = await buildStreamingResult(
      (async function* () {
        yield { text: 'parcial' };
        throw new Error('fallo del proveedor');
      })(),
      [],
    );

    await expect(collectStreamText(resultado.stream)).rejects.toThrow('fallo del proveedor');
    await expect(resultado.sources).resolves.toBeNull();
  });

  it('STREAM-007: conserva las imagenes generadas del turno', async () => {
    const resultado = await buildStreamingResult(generadorDeChunks([{ text: 'ok' }]), ['data:image/png;base64,AAA']);

    expect(resultado.generatedImages).toEqual(['data:image/png;base64,AAA']);
  });
});
