import { describe, expect, it } from 'vitest';
import {
  buildMessageContent,
  buildMultimodalContent,
  normalizeImagesToMediaRefs,
} from '../../services/gemini-chat/message-content';
import {
  MEDIA_BUDGET,
  buildPlaybackWindow,
  clampWindow,
  type MediaRef,
} from '../../shared/multimodal-input';

const IMAGEN = 'data:image/png;base64,QUJD';

describe('constructor de partes multimodales', () => {
  it('MEDIA-001: sin medios devuelve el mensaje tal cual', () => {
    const { content, envelope } = buildMultimodalContent('Hola');

    expect(content).toBe('Hola');
    expect(envelope.sent).toEqual([]);
    expect(envelope.resolution).toBeUndefined();
  });

  it('MEDIA-002: un medio en linea viaja como inlineData', () => {
    const { content, envelope } = buildMultimodalContent('Mira', [
      { kind: 'inline', mimeType: 'image/png', base64: 'QUJD' },
    ]);

    expect(content).toEqual(['Mira', { inlineData: { mimeType: 'image/png', data: 'QUJD' } }]);
    expect(envelope.sent).toEqual([{ kind: 'inline', mimeType: 'image/png' }]);
  });

  it('MEDIA-003: un archivo remoto viaja como fileData con su ventana', () => {
    const { content, envelope } = buildMultimodalContent('Analiza', [
      {
        kind: 'remote',
        mimeType: 'video/mp4',
        uri: 'https://archivos.test/v1',
        durationSeconds: 300,
        window: { startSeconds: 10, endSeconds: 40 },
      },
    ]);

    expect(content[1]).toEqual({
      fileData: { fileUri: 'https://archivos.test/v1', mimeType: 'video/mp4' },
      videoMetadata: { startOffset: '10s', endOffset: '40s' },
    });
    expect(envelope.sent[0]).toMatchObject({
      kind: 'remote',
      source: 'https://archivos.test/v1',
      window: { startSeconds: 10, endSeconds: 40 },
    });
  });

  it('MEDIA-004: un video publico viaja por URI sin descargarse', () => {
    const { content } = buildMultimodalContent('Que pasa aqui', [
      {
        kind: 'public-video',
        uri: 'https://www.youtube.com/watch?v=abc',
        durationSeconds: 600,
        window: { startSeconds: 100, endSeconds: 140 },
        fps: 1,
      },
    ]);

    expect(content[1]).toEqual({
      fileData: { fileUri: 'https://www.youtube.com/watch?v=abc', mimeType: 'video/mp4' },
      videoMetadata: { startOffset: '100s', endOffset: '140s', fps: 1 },
    });
  });

  it('MEDIA-005: el muestreo de cuadros viaja como imagenes y se declara como muestreo', () => {
    const { content, envelope } = buildMultimodalContent('Describe la escena', [
      {
        kind: 'frames',
        frames: [
          { base64: 'AAA', mimeType: 'image/jpeg', atSeconds: 0 },
          { base64: 'BBB', mimeType: 'image/jpeg', atSeconds: 2 },
        ],
      },
    ]);

    expect(content).toHaveLength(3);
    expect(envelope.sent[0]).toMatchObject({ kind: 'frames', frameCount: 2 });
  });

  it('MEDIA-006: un formato no admitido se rechaza con motivo y no viaja', () => {
    const { content, envelope } = buildMultimodalContent('Analiza', [
      { kind: 'inline', mimeType: 'application/zip', base64: 'AAA' },
    ]);

    expect(content).toBe('Analiza');
    expect(envelope.rejected).toEqual([
      expect.objectContaining({ reason: 'formato-no-admitido' }),
    ]);
  });

  it('MEDIA-007: un medio sin tipo determinable se rechaza en vez de adivinarse', () => {
    const { envelope } = buildMultimodalContent('Analiza', [
      { kind: 'inline', mimeType: '', base64: 'AAA' },
    ]);

    expect(envelope.rejected[0]).toMatchObject({ reason: 'tipo-indeterminado' });
  });

  it('MEDIA-008: un medio en linea sobre el tope se rechaza por limite', () => {
    const enorme = 'A'.repeat(MEDIA_BUDGET.maxInlineBytes * 2);
    const { envelope } = buildMultimodalContent('Analiza', [
      { kind: 'inline', mimeType: 'video/mp4', base64: enorme },
    ]);

    expect(envelope.rejected[0]).toMatchObject({ reason: 'excede-limite-proveedor' });
  });

  it('MEDIA-009: una ventana larga baja sola a resolucion reducida', () => {
    const { envelope } = buildMultimodalContent('Que dice', [
      {
        kind: 'public-video',
        uri: 'https://video.test/x',
        window: { startSeconds: 0, endSeconds: 60 },
      },
    ]);

    expect(envelope.resolution).toBe('low');
  });

  it('MEDIA-010: una resolucion pedida explicitamente manda cuando cabe en el presupuesto', () => {
    const { envelope } = buildMultimodalContent(
      'Lee las cifras del cuadro',
      [{ kind: 'inline', mimeType: 'image/png', base64: 'QUJD' }],
      'high',
    );

    expect(envelope.resolution).toBe('high');
  });

  it('MEDIA-011: ante presupuesto excedido baja primero la resolucion, no excluye el medio', () => {
    // 60 s a resolucion alta cuestan 36 000 tokens: por encima del presupuesto.
    // La respuesta correcta es entregar la evidencia con menos detalle, no
    // dejar al usuario sin ella.
    const { envelope } = buildMultimodalContent(
      'Lee lo que dice',
      [{ kind: 'public-video', uri: 'https://video.test/x', window: { startSeconds: 0, endSeconds: 60 } }],
      'high',
    );

    expect(envelope.sent).toHaveLength(1);
    expect(envelope.resolution).toBe('medium');
    expect(envelope.rejected).toEqual([]);
  });

  it('MEDIA-011B: si bajar la resolucion no basta, acorta la ventana conservando el instante actual', () => {
    const media: MediaRef[] = [
      { kind: 'public-video', uri: 'https://video.test/a', window: { startSeconds: 0, endSeconds: 90 } },
      { kind: 'public-video', uri: 'https://video.test/b', window: { startSeconds: 100, endSeconds: 190 } },
    ];
    const { content, envelope } = buildMultimodalContent('Compara', media, 'high');

    expect(envelope.resolution).toBe('low');
    expect(envelope.estimatedTokens).toBeLessThanOrEqual(MEDIA_BUDGET.maxMediaTokensPerTurn);
    // La ventana se recorta desde el inicio: el final es lo que el usuario ve.
    expect(content[2].videoMetadata.endOffset).toBe('190s');
    expect(envelope.sent).toHaveLength(2);
  });

  it('MEDIA-011C: un medio sin ventana que acortar se excluye y se declara', () => {
    // El audio no tiene ventana temporal que recortar ni depende de la
    // resolucion, asi que es la unica ruta que llega de verdad a la exclusion:
    // dos pistas de diez minutos superan el presupuesto del turno.
    const media: MediaRef[] = [
      { kind: 'inline', mimeType: 'audio/wav', base64: 'AAA', durationSeconds: 600 },
      { kind: 'inline', mimeType: 'audio/wav', base64: 'BBB', durationSeconds: 600 },
    ];
    const { envelope } = buildMultimodalContent('Compara las dos grabaciones', media);

    expect(envelope.sent).toHaveLength(1);
    expect(envelope.rejected.some((item) => item.reason === 'presupuesto-del-turno')).toBe(true);
    expect(envelope.estimatedTokens).toBeLessThanOrEqual(MEDIA_BUDGET.maxMediaTokensPerTurn);
  });

  it('MEDIA-012: el sobre estima el costo en tokens de lo enviado', () => {
    const { envelope } = buildMultimodalContent(
      'Resume',
      [{ kind: 'public-video', uri: 'https://video.test/x', window: { startSeconds: 0, endSeconds: 30 } }],
      'low',
    );

    expect(envelope.estimatedTokens).toBe(30 * 100);
  });

  it('MEDIA-013: las data URLs heredadas se normalizan a medios en linea', () => {
    expect(normalizeImagesToMediaRefs([IMAGEN])).toEqual([
      { kind: 'inline', mimeType: 'image/png', base64: 'QUJD' },
    ]);
  });

  it('MEDIA-014: la firma anterior sigue produciendo el mismo contenido', () => {
    expect(buildMessageContent('Hola', [IMAGEN])).toEqual([
      'Hola',
      { inlineData: { mimeType: 'image/png', data: 'QUJD' } },
    ]);
    expect(buildMessageContent('Hola')).toBe('Hola');
  });

  it('MEDIA-015: un adjunto de texto plano conserva su ruta anterior', () => {
    const contenido = buildMessageContent('Lee', ['data:application/octet-stream;base64,SG9sYQ==']);

    expect(contenido[1]).toEqual({ inlineData: { mimeType: 'text/plain', data: 'SG9sYQ==' } });
  });
});

describe('ventanas temporales', () => {
  it('WINDOW-001: una ventana anterior al inicio del medio se recorta a cero', () => {
    expect(buildPlaybackWindow(3)).toEqual({ startSeconds: 0, endSeconds: 13 });
  });

  it('WINDOW-002: una ventana posterior al final se recorta a la duracion real', () => {
    expect(buildPlaybackWindow(100, 105)).toEqual({ startSeconds: 70, endSeconds: 105 });
  });

  it('WINDOW-003: una posicion desconocida arranca desde el inicio', () => {
    expect(buildPlaybackWindow(null, 600)).toEqual({ startSeconds: 0, endSeconds: 10 });
  });

  it('WINDOW-004: ninguna ventana supera el maximo por turno', () => {
    const window = clampWindow({ startSeconds: 0, endSeconds: 10_000 }, 20_000);

    expect(window.endSeconds - window.startSeconds).toBe(MEDIA_BUDGET.maxVideoWindowSeconds);
  });
});
