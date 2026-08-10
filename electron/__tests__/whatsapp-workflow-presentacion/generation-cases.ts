import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WorkflowManager,
  createPresentationWorkflow,
  mockAgent,
  mockExportHtml,
  mockGenerateContent,
  mockSendFile,
  mockSendText,
  mockWaService,
  mockWorkspaceService,
  mockWriteFile,
  mockWriteSystemFile,
  resetPresentationWorkflowMocks,
} from './setup';
import type { PresentacionWorkflow } from './setup';

/**
 * El flujo expone su maquina de estados en privado; las pruebas la inspeccionan
 * mediante este acceso acotado en vez de `any` suelto por todo el archivo.
 */
type WorkflowInternals = {
  state: string;
  data: { clientCompanyName?: string; clientEmail?: string; proposalContent?: string };
  extractData: (text: string) => Promise<void>;
  finishPresentation: () => Promise<void>;
};

function internals(workflow: PresentacionWorkflow): WorkflowInternals {
  return workflow as unknown as WorkflowInternals;
}

const HTML_GENERADO = '<!doctype html><html><head><link rel="stylesheet" href="estilos/marca.css"></head><body><section class="diapositiva">Portada</section></body></html>';

/**
 * El flujo de presentaciones de WhatsApp usa el motor propio de HTML: escribe
 * los archivos en su espacio de trabajo, exporta el PDF y lo envia por el
 * mismo canal. Ya no existe ninguna llamada a un generador de terceros.
 */
describe('PresentacionWorkflow: extraccion de datos y generacion HTML', () => {
  let workflow: PresentacionWorkflow;

  beforeEach(() => {
    resetPresentationWorkflowMocks();
    workflow = createPresentationWorkflow();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WA-157: extractData lee el nombre de la empresa con Gemini', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '{"company": "DevOps Corp", "email": null}' } });
    await internals(workflow).extractData('La empresa es DevOps Corp');
    expect(internals(workflow).data.clientCompanyName).toBe('DevOps Corp');
  });

  it('WA-158: extractData lee el correo con Gemini', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '{"company": null, "email": "user@example.com"}' } });
    await internals(workflow).extractData('mi correo es user@example.com');
    expect(internals(workflow).data.clientEmail).toBe('user@example.com');
  });

  it('WA-159: rechaza entradas extra mientras genera, con mensaje de espera', async () => {
    internals(workflow).state = 'GENERATING_PRESENTATION';
    const handled = await workflow.handleInput('apurate');
    expect(handled).toBe(true);
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Terminando de generar'));
  });

  it('WA-160: genera la presentacion con el motor propio y entrega el HTML', async () => {
    internals(workflow).state = 'GENERATING_PRESENTATION';
    internals(workflow).data = { clientCompanyName: 'TestCo', clientEmail: 'test@testco.com', proposalContent: 'Propuesta de prueba' };
    mockGenerateContent.mockResolvedValue({ response: { text: () => HTML_GENERADO } });

    await internals(workflow).finishPresentation();

    expect(mockWorkspaceService.createWorkspace).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith('ws-test', 'index.html', expect.stringContaining('<!doctype html'));
    expect(mockExportHtml).toHaveBeenCalled();
    expect(mockSendFile).toHaveBeenCalledWith(expect.any(String), '/tmp/ws-test/demo.html', expect.any(String));
    expect(internals(workflow).state).toBe('COMPLETED');
  });

  it('WA-163: escribe la hoja de marca antes de generar y el modelo no la toca', async () => {
    internals(workflow).state = 'GENERATING_PRESENTATION';
    internals(workflow).data = { clientCompanyName: 'TestCo', clientEmail: 'test@testco.com', proposalContent: 'Propuesta' };
    mockGenerateContent.mockResolvedValue({ response: { text: () => HTML_GENERADO } });

    await internals(workflow).finishPresentation();

    // La hoja de marca la escribe el sistema, no el modelo.
    expect(mockWriteSystemFile).toHaveBeenCalledWith('ws-test', 'estilos/marca.css', expect.stringContaining('--marca-color-primario'));
    expect(mockWriteFile).not.toHaveBeenCalledWith('ws-test', 'estilos/marca.css', expect.anything());
  });

  it('WA-164: no llama a ningun generador de presentaciones externo', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    internals(workflow).state = 'GENERATING_PRESENTATION';
    internals(workflow).data = { clientCompanyName: 'TestCo', clientEmail: 'test@testco.com', proposalContent: 'Propuesta' };
    mockGenerateContent.mockResolvedValue({ response: { text: () => HTML_GENERADO } });

    await internals(workflow).finishPresentation();

    const destinos = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(destinos.some((url) => url.includes('gamma'))).toBe(false);
  });

  it('WA-165: informa sin enviar archivo si el modelo no devuelve un documento', async () => {
    internals(workflow).state = 'GENERATING_PRESENTATION';
    internals(workflow).data = { clientCompanyName: 'TestCo', clientEmail: 'test@testco.com', proposalContent: 'Propuesta' };
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'Lo siento, no puedo.' } });

    await internals(workflow).finishPresentation();

    expect(mockSendFile).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('No pude completar'));
  });

  it('WA-161: permite cancelar en lenguaje natural desde AWAITING_DATA', async () => {
    const extractSpy = vi.spyOn(internals(workflow), 'extractData');
    const handled = await workflow.handleInput('Cancela el flujo');
    expect(handled).toBe(false);
    expect(extractSpy).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('cancelado'));
  });

  it('WA-166: cancelar no genera ni envia nada', async () => {
    await workflow.handleInput('cancelar');

    expect(mockWorkspaceService.createWorkspace).not.toHaveBeenCalled();
    expect(mockSendFile).not.toHaveBeenCalled();
  });

  it('WA-162: cancela el flujo tras 5 minutos de inactividad', async () => {
    vi.useFakeTimers();
    await WorkflowManager.startWorkflow(
      'mgr-timeout',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as unknown as Parameters<typeof WorkflowManager.startWorkflow>[3],
      mockAgent as unknown as Parameters<typeof WorkflowManager.startWorkflow>[4],
      mockWorkspaceService as unknown as Parameters<typeof WorkflowManager.startWorkflow>[5],
    );

    expect(WorkflowManager.isActive('mgr-timeout')).toBe(true);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(WorkflowManager.isActive('mgr-timeout')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith('5551234567@s.whatsapp.net', expect.stringContaining('inactividad'));
  });
});
