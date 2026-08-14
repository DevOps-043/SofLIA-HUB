import { describe, expect, it, vi } from 'vitest';
import { extractAppContext, type CascadeDeps } from '../desktop-context/cascade';
import { matchDocumentToWindow } from '../desktop-context/office-com';
import { DESKTOP_CONTEXT_LIMITS } from '../desktop-context/types';
import type { DesktopWindowRecord } from '../desktop-context/inventory';

const excelWindow: DesktopWindowRecord = {
  id: 'app-4321-abc123',
  title: 'Presupuesto 2026 - Excel',
  appName: 'EXCEL',
  pid: 4321,
  thumbnail: '',
  sourceId: 'window:1:0',
  expectedLevel: 'documento',
};

const notepadWindow: DesktopWindowRecord = {
  ...excelWindow,
  id: 'app-4323-def456',
  title: 'Notas',
  appName: 'notepad',
  pid: 4323,
  expectedLevel: 'accesibilidad',
};

function makeDeps(overrides: Partial<CascadeDeps> = {}): CascadeDeps {
  return {
    availableLevels: ['documento', 'accesibilidad', 'captura'],
    listOfficeDocuments: vi.fn(async () => [
      { path: 'C:\\Users\\ana\\Presupuesto 2026.xlsx', name: 'Presupuesto 2026.xlsx', saved: true },
    ]),
    isSidecarDocument: vi.fn(() => true),
    parseDocument: vi.fn(async () => '| Concepto | Importe |\n| --- | --- |\n| Nómina | 1200 |'),
    extractWindowText: vi.fn(async () => ({ text: 'texto de la ventana', source: 'texto_raiz' })),
    captureWindow: vi.fn(async () => 'data:image/png;base64,captura'),
    fileExists: vi.fn(() => true),
    ...overrides,
  };
}

describe('cascada de extraccion de contexto de escritorio', () => {
  it('nivel A: lee el documento completo del disco y conserva las tablas', async () => {
    const deps = makeDeps();
    const attachment = await extractAppContext(excelWindow, deps);

    expect(attachment.level).toBe('documento');
    expect(attachment.source).toBe('Presupuesto 2026.xlsx');
    expect(attachment.text).toContain('| Nómina | 1200 |');
    expect(attachment.warnings).toEqual([]);
    // El nivel A conserva el documento completo y suma la vista visual actual.
    expect(deps.extractWindowText).not.toHaveBeenCalled();
    expect(deps.captureWindow).toHaveBeenCalledWith('window:1:0');
    expect(attachment.image).toBe('data:image/png;base64,captura');
  });

  it('nivel A conserva el documento aunque falle su visual de apoyo', async () => {
    const deps = makeDeps({ captureWindow: vi.fn(async () => { throw new Error('ventana cerrada'); }) });

    const attachment = await extractAppContext(excelWindow, deps);

    expect(attachment.level).toBe('documento');
    expect(attachment.text).toContain('| Nómina | 1200 |');
    expect(attachment.image).toBeUndefined();
  });

  it('nivel A marca el adjunto cuando el archivo en disco esta desactualizado', async () => {
    const deps = makeDeps({
      listOfficeDocuments: vi.fn(async () => [
        { path: 'C:\\Users\\ana\\Presupuesto 2026.xlsx', name: 'Presupuesto 2026.xlsx', saved: false },
      ]),
    });

    const attachment = await extractAppContext(excelWindow, deps);

    expect(attachment.level).toBe('documento');
    expect(attachment.warnings).toContain('cambios_sin_guardar');
  });

  it('degrada cuando el documento nunca se guardo en disco', async () => {
    const deps = makeDeps({ fileExists: vi.fn(() => false) });

    const attachment = await extractAppContext(excelWindow, deps);

    expect(attachment.level).toBe('accesibilidad');
    expect(deps.parseDocument).not.toHaveBeenCalled();
  });

  it('descarta la ruta que no corresponde a la ventana marcada', async () => {
    const deps = makeDeps({
      listOfficeDocuments: vi.fn(async () => [
        { path: 'C:\\Users\\ana\\Otro libro.xlsx', name: 'Otro libro.xlsx', saved: true },
      ]),
    });

    const attachment = await extractAppContext(excelWindow, deps);

    // Antes de adjuntar el documento equivocado, se degrada.
    expect(attachment.level).toBe('accesibilidad');
    expect(deps.parseDocument).not.toHaveBeenCalled();
  });

  it('degrada cuando la extension no la soporta el sidecar', async () => {
    const deps = makeDeps({ isSidecarDocument: vi.fn(() => false) });

    const attachment = await extractAppContext(excelWindow, deps);
    expect(attachment.level).toBe('accesibilidad');
  });

  it('degrada cuando el sidecar devuelve un documento vacio', async () => {
    const deps = makeDeps({ parseDocument: vi.fn(async () => '   ') });

    const attachment = await extractAppContext(excelWindow, deps);
    expect(attachment.level).toBe('accesibilidad');
  });

  it('nivel B: lee texto de una aplicacion que no es de Office', async () => {
    const deps = makeDeps();
    const attachment = await extractAppContext(notepadWindow, deps);

    expect(attachment.level).toBe('accesibilidad');
    expect(attachment.text).toBe('texto de la ventana');
    expect(deps.listOfficeDocuments).not.toHaveBeenCalled();
    expect(deps.captureWindow).not.toHaveBeenCalled();
  });

  it('nivel C: cae a captura cuando la accesibilidad no entrega texto', async () => {
    const deps = makeDeps({ extractWindowText: vi.fn(async () => ({ text: '', source: 'ninguno' })) });

    const attachment = await extractAppContext(notepadWindow, deps);

    expect(attachment.level).toBe('captura');
    expect(attachment.image).toBe('data:image/png;base64,captura');
    expect(attachment.warnings).toContain('solo_visible');
  });

  it('la ventana cerrada durante la extraccion falla de forma aislada y con aviso', async () => {
    const deps = makeDeps({
      extractWindowText: vi.fn(async () => ({ text: '', source: 'sin_proceso' })),
      captureWindow: vi.fn(async () => ''),
    });

    const attachment = await extractAppContext(notepadWindow, deps);

    expect(attachment.level).toBe('captura');
    expect(attachment.image).toBeUndefined();
    expect(attachment.warnings).toContain('sin_texto');
  });

  it('un fallo del nivel A no aborta la cascada', async () => {
    const deps = makeDeps({
      listOfficeDocuments: vi.fn(async () => {
        throw new Error('COM no disponible');
      }),
    });

    const attachment = await extractAppContext(excelWindow, deps);
    expect(attachment.level).toBe('accesibilidad');
  });

  it('trunca el contenido que supera el tope por aplicacion y lo declara', async () => {
    const largo = 'x'.repeat(DESKTOP_CONTEXT_LIMITS.maxCharsPerApp + 500);
    const deps = makeDeps({ parseDocument: vi.fn(async () => largo) });

    const attachment = await extractAppContext(excelWindow, deps);

    expect(attachment.text).toHaveLength(DESKTOP_CONTEXT_LIMITS.maxCharsPerApp);
    expect(attachment.charCount).toBe(DESKTOP_CONTEXT_LIMITS.maxCharsPerApp);
    expect(attachment.warnings).toContain('contenido_truncado');
  });

  it('fuera de Windows va directo a captura', async () => {
    const deps = makeDeps({ availableLevels: ['captura'] });

    const attachment = await extractAppContext(excelWindow, deps);

    expect(attachment.level).toBe('captura');
    expect(deps.listOfficeDocuments).not.toHaveBeenCalled();
    expect(deps.extractWindowText).not.toHaveBeenCalled();
  });
});

describe('emparejado de documento con ventana', () => {
  const documentos = [
    { path: 'C:\\docs\\Presupuesto 2026.xlsx', name: 'Presupuesto 2026.xlsx', saved: true },
    { path: 'C:\\docs\\Contrato.docx', name: 'Contrato.docx', saved: true },
  ];

  it('empareja por nombre base porque Office omite la extension en el titulo', () => {
    expect(matchDocumentToWindow('Presupuesto 2026 - Excel', documentos)?.path)
      .toBe('C:\\docs\\Presupuesto 2026.xlsx');
  });

  it('empareja tambien cuando el titulo conserva la extension', () => {
    expect(matchDocumentToWindow('Contrato.docx - Word', documentos)?.path)
      .toBe('C:\\docs\\Contrato.docx');
  });

  it('devuelve null cuando ningun documento corresponde al titulo', () => {
    expect(matchDocumentToWindow('Informe anual - Excel', documentos)).toBeNull();
  });

  it('devuelve null con titulo vacio', () => {
    expect(matchDocumentToWindow('   ', documentos)).toBeNull();
  });
});
