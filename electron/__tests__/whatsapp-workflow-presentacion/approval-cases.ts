import { expect, it } from 'vitest';
import { mockGenerateContent, mockSendFile, mockSendText } from './setup';
import type { PresentationWorkflowTestContext } from './types';

type WorkflowInternals = {
  state: string;
  data: { clientCompanyName?: string; clientEmail?: string; proposalContent?: string };
  finishPresentation: () => Promise<void>;
};

/** Acceso acotado a la maquina de estados privada del flujo. */
function internals(ctx: PresentationWorkflowTestContext): WorkflowInternals {
  return ctx.getWorkflow() as unknown as WorkflowInternals;
}

const HTML_GENERADO = '<!doctype html><html><body><section class="diapositiva">Portada</section></body></html>';

function setWorkflowData(workflow: WorkflowInternals) {
  workflow.data = {
    clientCompanyName: 'TechCorp',
    clientEmail: 'test@techcorp.com',
    proposalContent: 'Resumen de prueba',
  };
}

/**
 * La aprobacion del usuario (HITL) es la puerta previa tanto a generar como a
 * enviar el archivo: sin ella el flujo no produce ni entrega nada.
 */
export function registerPresentationApprovalTests(ctx: PresentationWorkflowTestContext) {
  it('WA-154: la aprobacion HITL pasa a GENERATING_PRESENTATION', async () => {
    const workflow = internals(ctx);
    workflow.state = 'AWAITING_APPROVAL';
    setWorkflowData(workflow);
    mockGenerateContent.mockResolvedValue({ response: { text: () => HTML_GENERADO } });

    expect(await ctx.getWorkflow().handleInput('si')).toBe(true);
    expect(workflow.state).toBe('GENERATING_PRESENTATION');
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Aprobado'));
  });

  it('WA-155: rechazar con cancelar termina el flujo', async () => {
    internals(ctx).state = 'AWAITING_APPROVAL';
    expect(await ctx.getWorkflow().handleInput('no, cancelar')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('cancelado'));
  });

  it('WA-167: sin aprobacion no se genera ni se envia archivo', async () => {
    const workflow = internals(ctx);
    workflow.state = 'AWAITING_APPROVAL';
    setWorkflowData(workflow);

    await ctx.getWorkflow().handleInput('todavia no estoy seguro');

    expect(workflow.state).toBe('AWAITING_APPROVAL');
    expect(mockSendFile).not.toHaveBeenCalled();
  });

  it('WA-156: finishPresentation llega a COMPLETED y entrega el archivo', async () => {
    const workflow = internals(ctx);
    workflow.state = 'GENERATING_PRESENTATION';
    workflow.data = {
      clientCompanyName: 'MiEmpresa',
      clientEmail: 'info@miempresa.com',
      proposalContent: 'Propuesta de valor',
    };
    mockGenerateContent.mockResolvedValue({ response: { text: () => HTML_GENERADO } });

    await workflow.finishPresentation();

    expect(workflow.state).toBe('COMPLETED');
    expect(mockSendFile).toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Flujo completado'));
  });
}
