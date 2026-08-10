import { describe, expect, it, vi } from 'vitest';
import {
  extractAccessibleReadingDocument,
  extractReadingDocumentFromAxNodes,
} from '../integrated-browser/reading-accessibility';

const value = (text: string) => ({ type: 'string', value: text });

describe('extracción accesible del modo lectura', () => {
  it('READ-024: prioriza el editor documental y descarta navegación de Google Docs', () => {
    const result = extractReadingDocumentFromAxNodes([
      { nodeId: 'root', role: value('RootWebArea'), name: value('Google Docs'), childIds: ['tabs', 'editor'] },
      { nodeId: 'tabs', role: value('Navigation'), name: value('Pestañas del documento'), childIds: ['tab-label'] },
      { nodeId: 'tab-label', role: value('StaticText'), name: value('DOCUMENTO CORPORATIVO') },
      {
        nodeId: 'editor',
        role: value('textbox'),
        name: value('Contenido del documento'),
        value: value('Modelo SofLIA de Evolución Organizacional. Del conocimiento individual a las capacidades empresariales.'),
      },
    ], 'Modelo organizacional', 60_000);

    expect(result?.blocks.map((block) => block.text)).toEqual([
      'Modelo SofLIA de Evolución Organizacional. Del conocimiento individual a las capacidades empresariales.',
    ]);
    expect(JSON.stringify(result)).not.toContain('Pestañas del documento');
  });

  it('READ-025: activa el árbol AX solo durante la captura y libera el depurador', async () => {
    const sendCommand = vi.fn(async (method: string) => method === 'Accessibility.getFullAXTree'
      ? {
        nodes: [
          { nodeId: 'editor', role: value('textbox'), value: value('Contenido accesible del documento con suficiente detalle.') },
        ],
      }
      : {});
    const attach = vi.fn();
    const detach = vi.fn();
    let attached = false;
    attach.mockImplementation(() => { attached = true; });
    detach.mockImplementation(() => { attached = false; });
    const contents = {
      isDestroyed: vi.fn(() => false),
      getTitle: vi.fn(() => 'Documento accesible'),
      debugger: {
        isAttached: vi.fn(() => attached),
        attach,
        detach,
        sendCommand,
      },
    } as unknown as Electron.WebContents;

    await expect(extractAccessibleReadingDocument(contents, 60_000)).resolves.toMatchObject({
      title: 'Documento accesible',
      blocks: [{ text: 'Contenido accesible del documento con suficiente detalle.' }],
    });
    expect(attach).toHaveBeenCalledWith('1.3');
    expect(sendCommand.mock.calls.map(([method]) => method)).toEqual([
      'Accessibility.enable',
      'Accessibility.getFullAXTree',
      'Accessibility.disable',
    ]);
    expect(detach).toHaveBeenCalledOnce();
  });

  it('READ-029: conserva enlaces y celdas que pertenecen al cuerpo documental', () => {
    const result = extractReadingDocumentFromAxNodes([
      { nodeId: 'editor', role: value('document'), name: value('Contenido editable'), childIds: ['p', 'link', 'cell'] },
      { nodeId: 'p', role: value('paragraph'), name: value('Consulta la evidencia del proyecto.') },
      { nodeId: 'link', role: value('link'), name: value('Repositorio de referencia') },
      { nodeId: 'cell', role: value('cell'), name: value('Responsable: Equipo SofLIA') },
    ], 'Documento con estructura', 60_000);

    expect(result?.blocks.map((block) => block.text)).toEqual([
      'Consulta la evidencia del proyecto.',
      'Repositorio de referencia',
      'Responsable: Equipo SofLIA',
    ]);
  });
});
