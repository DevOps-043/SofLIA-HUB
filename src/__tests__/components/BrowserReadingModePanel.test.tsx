import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  buildReadingSegments,
  findTimingAtTime,
  SPEECH_FIRST_SEGMENT_MAX_CHARS,
  SPEECH_SEGMENT_MAX_CHARS,
} from '../../components/browser/browser-reading-utils';
import { BrowserReadingModePanel } from '../../components/browser/BrowserReadingModePanel';
import type {
  BrowserReadingToolbarActionName,
  IntegratedBrowserApi,
} from '../../services/integrated-browser-service';
import { extractReadingDocumentInPage } from '../../../electron/integrated-browser/reading-mode-content';

const baseContent = {
  readingId: 'reading-123',
  tabId: 'tab-1',
  url: 'https://example.com/documento',
  title: 'Documento ejecutivo',
  language: 'es',
  text: 'Hola mundo',
  blocks: [{ id: 'block-1', kind: 'paragraph' as const, text: 'Hola mundo', level: null, start: 0, end: 10 }],
  selectionOnly: true,
  truncated: false,
};

class MockAudio {
  currentTime = 0;
  duration = 1;
  playbackRate = 1;
  preload = '';
  ended = false;
  onloadedmetadata: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onplay: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onended: (() => void) | null = null;
  pause = vi.fn(() => this.onpause?.());
  load = vi.fn();
  removeAttribute = vi.fn();
  play = vi.fn(async () => {
    this.onloadedmetadata?.();
    this.onplay?.();
  });
}

describe('BrowserReadingModePanel', () => {
  let api: IntegratedBrowserApi;
  let audio: MockAudio | null;
  let actions: BrowserReadingToolbarActionName[];

  beforeEach(() => {
    audio = null;
    actions = ['closed'];
    api = {
      synthesizeReadingSegment: vi.fn(async (input) => ({
        success: true,
        speech: {
          readingId: input.readingId, start: input.start, end: input.end,
          audioBase64: 'YXVkaW8=', mimeType: 'audio/mpeg' as const, durationSeconds: 1,
          timings: [{ start: input.start, end: input.end, startTime: 0, endTime: 1 }],
        },
      })),
      cancelReadingSpeech: vi.fn(async () => ({ success: true, canceled: 0 })),
      highlightReadingRange: vi.fn(async () => ({ success: true, highlighted: true })),
      waitForReadingToolbarAction: vi.fn(async (input) => ({
        success: true,
        toolbarAction: { readingId: input.readingId, action: actions.shift() ?? 'closed' },
      })),
      syncReadingToolbar: vi.fn(async () => ({ success: true, toolbarVisible: true })),
    } as unknown as IntegratedBrowserApi;
    Object.defineProperty(window, 'integratedBrowser', { value: api, configurable: true, writable: true });
    function TestAudio() {
      audio = new MockAudio();
      return audio;
    }
    vi.stubGlobal('Audio', TestAudio);
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:lectura'), revokeObjectURL: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: vi.fn(), configurable: true });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('READ-007: reproduce el primer fragmento corto y precarga dos segmentos mientras escucha', async () => {
    actions = ['toggle', 'closed'];
    const text = `${'Una oración ejecutiva con contexto suficiente. '.repeat(80)}Fin.`;
    const content = { ...baseContent, text, blocks: [{ ...baseContent.blocks[0], text, end: text.length }] };
    render(<BrowserReadingModePanel content={content} onClose={vi.fn()} />);

    await waitFor(() => expect(api.synthesizeReadingSegment).toHaveBeenCalledTimes(3));
    const calls = vi.mocked(api.synthesizeReadingSegment).mock.calls.map(([input]) => input);
    expect(calls[0].end - calls[0].start).toBeLessThanOrEqual(SPEECH_FIRST_SEGMENT_MAX_CHARS);
    expect(calls.slice(1).every((input) => input.end - input.start <= SPEECH_SEGMENT_MAX_CHARS)).toBe(true);
    expect(audio?.play).toHaveBeenCalled();
    expect(api.cancelReadingSpeech).not.toHaveBeenCalled();

    act(() => {
      if (!audio) throw new Error('Audio no creado');
      audio.currentTime = 0.4;
      audio.ontimeupdate?.();
    });
    await waitFor(() => expect(api.highlightReadingRange).toHaveBeenCalled());
  });

  it('READ-011: sincroniza velocidad y estado con la cápsula contextual', async () => {
    actions = ['speed-up', 'closed'];
    render(<BrowserReadingModePanel content={baseContent} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Controlador del modo lectura')).toBeInTheDocument();
    await waitFor(() => expect(api.syncReadingToolbar).toHaveBeenCalledWith(expect.objectContaining({
      readingId: baseContent.readingId,
      speed: 1.25,
    })));
  });

  it('READ-008: cancela la cola y libera audio al cerrar desde la cápsula', async () => {
    let actionIndex = 0;
    vi.mocked(api.waitForReadingToolbarAction).mockImplementation(async (input) => {
      actionIndex += 1;
      if (actionIndex === 1) return { success: true, toolbarAction: { readingId: input.readingId, action: 'toggle' } };
      if (actionIndex === 2) {
        await vi.waitFor(() => expect(audio?.play).toHaveBeenCalled());
        return { success: true, toolbarAction: { readingId: input.readingId, action: 'close' } };
      }
      return { success: true, toolbarAction: { readingId: input.readingId, action: 'closed' } };
    });
    const onClose = vi.fn();
    render(<BrowserReadingModePanel content={baseContent} onClose={onClose} />);
    await waitFor(() => expect(audio?.play).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.cancelReadingSpeech).toHaveBeenCalledWith({ readingId: baseContent.readingId });
    expect(audio?.pause).toHaveBeenCalled();
  });

  it('READ-009: segmenta el inicio con menor latencia y conserva límites legibles', () => {
    const text = `${'Palabra '.repeat(500)}Fin.`;
    const segments = buildReadingSegments(text);
    expect(segments.length).toBeGreaterThan(3);
    expect(segments[0].end - segments[0].start).toBeLessThanOrEqual(SPEECH_FIRST_SEGMENT_MAX_CHARS);
    expect(segments.slice(1).every((segment) => segment.end - segment.start <= SPEECH_SEGMENT_MAX_CHARS)).toBe(true);
    expect(findTimingAtTime([
      { start: 0, end: 4, startTime: 0, endTime: 0.4 },
      { start: 5, end: 10, startTime: 0.5, endTime: 1 },
    ], 0.75)).toMatchObject({ start: 5, end: 10 });
  });

  it('READ-021: no repite automáticamente un lote anticipado que falló', async () => {
    actions = ['toggle', 'closed'];
    const text = `${'Una frase para probar la cola de voz. '.repeat(80)}Fin.`;
    vi.mocked(api.synthesizeReadingSegment).mockImplementation(async (input) => {
      if (input.start > 0) return { success: false, error: 'Proveedor no disponible.' };
      return {
        success: true,
        speech: {
          readingId: input.readingId, start: input.start, end: input.end,
          audioBase64: 'YXVkaW8=', mimeType: 'audio/mpeg', durationSeconds: 1,
          timings: [{ start: input.start, end: input.end, startTime: 0, endTime: 1 }],
        },
      };
    });
    const content = { ...baseContent, text, blocks: [{ ...baseContent.blocks[0], text, end: text.length }] };
    render(<BrowserReadingModePanel content={content} onClose={vi.fn()} />);

    await waitFor(() => expect(api.synthesizeReadingSegment).toHaveBeenCalledTimes(3));
    await act(async () => {
      if (!audio) throw new Error('Audio no creado');
      audio.onended?.();
      await Promise.resolve();
    });

    expect(api.synthesizeReadingSegment).toHaveBeenCalledTimes(3);
  });

  it('READ-010: en Google Docs toma la exportacion del documento, no la interfaz', async () => {
    document.title = 'Plan estratégico';
    // Docs dibuja el texto en un canvas: el DOM solo tiene interfaz.
    document.body.innerHTML = '<main><p>Introducción</p><p>Contenido del documento.</p></main><nav>Pestañas del documento</nav><input value="secreto">';
    const fetchStub = vi.fn(async () => ({ ok: true, text: async () => 'Introducción' + String.fromCharCode(10) + 'Contenido del documento.' }));
    vi.stubGlobal('fetch', fetchStub);

    const extracted = extractReadingDocumentInPage(60_000);

    expect(fetchStub).not.toHaveBeenCalled();
    expect(extracted?.blocks.map((block) => block.text)).toEqual(['Introducción', 'Contenido del documento.']);
    expect(JSON.stringify(extracted)).not.toContain('secreto');
    expect(JSON.stringify(extracted)).not.toContain('Pestañas del documento');
  });
});
