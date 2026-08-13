import { describe, expect, it, vi } from 'vitest';
import {
  APP_CONTEXT_LIMITS,
  buildAppContextBlock,
  resolveAppAttachments,
  startAppExtraction,
  type AppContextAttachmentState,
} from '../../adapters/desktop_ui/chat-ui/app-attachments';
import type { DesktopAppContextAttachment } from '../../services/desktop-context-service';

function attachment(overrides: Partial<DesktopAppContextAttachment> = {}): DesktopAppContextAttachment {
  return {
    appId: 'app-1-aaaaaa',
    title: 'Presupuesto 2026 - Excel',
    appName: 'EXCEL',
    level: 'documento',
    source: 'Presupuesto 2026.xlsx',
    text: '| Concepto | Importe |',
    warnings: [],
    charCount: 22,
    ...overrides,
  };
}

function listo(overrides: Partial<DesktopAppContextAttachment> = {}): AppContextAttachmentState {
  const data = attachment(overrides);
  return {
    appId: data.appId,
    title: data.title,
    appName: data.appName,
    expectedLevel: data.level,
    status: 'listo',
    attachment: data,
  };
}

describe('bloque de contexto de aplicaciones', () => {
  it('declara procedencia del documento y respeta el contenido', () => {
    const { block, images } = buildAppContextBlock([listo()], APP_CONTEXT_LIMITS.maxCharsPerTurn);

    expect(block).toContain('Aplicación 1: Presupuesto 2026 - Excel (EXCEL)');
    expect(block).toContain('documento completo leído del archivo "Presupuesto 2026.xlsx"');
    expect(block).toContain('| Concepto | Importe |');
    expect(images).toEqual([]);
  });

  it('declara los cambios sin guardar para que el modelo no de por vigentes las cifras', () => {
    const entry = listo({ warnings: ['cambios_sin_guardar'] });
    const { block } = buildAppContextBlock([entry], APP_CONTEXT_LIMITS.maxCharsPerTurn);

    expect(block).toContain('Avisos: con cambios sin guardar.');
  });

  it('acota la autoridad de una captura y la adjunta como imagen del turno', () => {
    const entry = listo({
      level: 'captura',
      text: '',
      image: 'data:image/png;base64,captura',
      warnings: ['solo_visible'],
      source: 'Notas',
    });

    const { block, images } = buildAppContextBlock([entry], APP_CONTEXT_LIMITS.maxCharsPerTurn);

    expect(block).toContain('solo refleja lo visible en pantalla');
    expect(block).toContain('limita tus afirmaciones a lo visible');
    expect(images).toEqual(['data:image/png;base64,captura']);
  });

  it('prohibe inventar contenido cuando la captura no pudo obtenerse', () => {
    const entry = listo({ level: 'captura', text: '', warnings: ['sin_texto'] });
    const { block, images } = buildAppContextBlock([entry], APP_CONTEXT_LIMITS.maxCharsPerTurn);

    expect(block).toContain('No infieras lo que muestra esta ventana');
    expect(images).toEqual([]);
  });

  it('recorta por el limite del turno y lo declara', () => {
    const entry = listo({ text: 'y'.repeat(500) });
    const { block, charsUsed } = buildAppContextBlock([entry], 100);

    expect(charsUsed).toBe(100);
    expect(block).toContain('contenido recortado por el límite de contexto de este turno');
  });

  it('omite las aplicaciones que ya no caben en el turno, sin romper el resto', () => {
    const primera = listo({ text: 'z'.repeat(120) });
    const segunda = { ...listo({ appId: 'app-2-bbbbbb', text: 'otra cosa' }), appId: 'app-2-bbbbbb' };

    const { block } = buildAppContextBlock([primera, segunda], 100);

    expect(block).toContain('Aplicación 1');
    expect(block).toContain('Contenido omitido: se alcanzó el límite de contexto de este turno');
  });

  it('declara el fallo aislado de una aplicacion sin descartar las demas', () => {
    const fallida: AppContextAttachmentState = {
      appId: 'app-9-999999',
      title: 'Word',
      appName: 'WINWORD',
      expectedLevel: 'documento',
      status: 'error',
      error: 'La aplicación ya no está abierta',
    };

    const { block } = buildAppContextBlock([fallida, listo()], APP_CONTEXT_LIMITS.maxCharsPerTurn);

    expect(block).toContain('No se pudo leer esta aplicación: La aplicación ya no está abierta');
    expect(block).toContain('No infieras su contenido');
    expect(block).toContain('| Concepto | Importe |');
  });
});

describe('resolucion de lecturas pendientes al enviar', () => {
  it('devuelve tal cual lo que ya estaba resuelto', async () => {
    const entry = listo();
    const resolved = await resolveAppAttachments([entry], new Map());
    expect(resolved).toEqual([entry]);
  });

  it('espera la lectura en curso y adopta su resultado', async () => {
    const pendiente: AppContextAttachmentState = {
      appId: 'app-1-aaaaaa',
      title: 'Excel',
      appName: 'EXCEL',
      expectedLevel: 'documento',
      status: 'pendiente',
    };
    const extractions = new Map([[pendiente.appId, Promise.resolve(listo())]]);

    const [resolved] = await resolveAppAttachments([pendiente], extractions);
    expect(resolved.status).toBe('listo');
  });

  it('omite con aviso la lectura que supera el presupuesto en lugar de retener el turno', async () => {
    const pendiente: AppContextAttachmentState = {
      appId: 'app-1-aaaaaa',
      title: 'Excel',
      appName: 'EXCEL',
      expectedLevel: 'documento',
      status: 'pendiente',
    };
    const nuncaResuelve = new Promise<AppContextAttachmentState>(() => {});
    const extractions = new Map([[pendiente.appId, nuncaResuelve]]);

    const [resolved] = await resolveAppAttachments([pendiente], extractions, 20);

    expect(resolved.status).toBe('error');
    expect(resolved.error).toContain('tiempo permitido');
  });

  it('marca error cuando no hay lectura registrada para una entrada pendiente', async () => {
    const pendiente: AppContextAttachmentState = {
      appId: 'app-1-aaaaaa',
      title: 'Excel',
      appName: 'EXCEL',
      expectedLevel: 'documento',
      status: 'pendiente',
    };

    const [resolved] = await resolveAppAttachments([pendiente], new Map());
    expect(resolved.status).toBe('error');
  });
});

describe('arranque de la lectura al marcar', () => {
  const entry: AppContextAttachmentState = {
    appId: 'app-1-aaaaaa',
    title: 'Excel',
    appName: 'EXCEL',
    expectedLevel: 'documento',
    status: 'pendiente',
  };

  it('refresca el chip con el nivel real cuando la lectura termina', async () => {
    window.desktopContext = {
      listApps: vi.fn(),
      captureApp: vi.fn(async () => ({ success: true, attachment: attachment({ level: 'captura' }) })),
    } as never;

    const setAttached = vi.fn();
    const store = { attached: [entry], setAttached, extractions: { current: new Map() } };

    startAppExtraction(entry, store as never);
    await store.extractions.current.get(entry.appId);
    await Promise.resolve();

    const updater = setAttached.mock.calls[0][0] as (list: AppContextAttachmentState[]) => AppContextAttachmentState[];
    expect(updater([entry])[0]).toMatchObject({ status: 'listo', attachment: { level: 'captura' } });
  });

  it('no reintroduce una aplicacion que el usuario desmarco mientras se leia', async () => {
    window.desktopContext = {
      listApps: vi.fn(),
      captureApp: vi.fn(async () => ({ success: true, attachment: attachment() })),
    } as never;

    const setAttached = vi.fn();
    const store = { attached: [entry], setAttached, extractions: { current: new Map() } };

    startAppExtraction(entry, store as never);
    await store.extractions.current.get(entry.appId);
    await Promise.resolve();

    const updater = setAttached.mock.calls[0][0] as (list: AppContextAttachmentState[]) => AppContextAttachmentState[];
    expect(updater([])).toEqual([]);
  });

  it('convierte un error del canal en estado de error del chip', async () => {
    window.desktopContext = {
      listApps: vi.fn(),
      captureApp: vi.fn(async () => ({ success: false, error: 'La aplicación ya no está en el inventario.' })),
    } as never;

    const store = { attached: [entry], setAttached: vi.fn(), extractions: { current: new Map() } };

    startAppExtraction(entry, store as never);
    const resolved = await store.extractions.current.get(entry.appId);

    expect(resolved).toMatchObject({ status: 'error', error: 'La aplicación ya no está en el inventario.' });
  });
});
