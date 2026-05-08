import { describe, expect, it, vi } from 'vitest';
import { createAgentWithService } from './create-agent';
import type { WhatsAppAgentTestContext } from './types';

export function registerPassiveWorkflowTests(ctx: WhatsAppAgentTestContext): void {
  describe('Passive workflows', () => {
    it('detects natural scheduled requests and stores a passive workflow instead of sending them to Gemini', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      const savePassiveRule = vi.fn().mockReturnValue({
        id: 'task_1',
        name: 'Resumen de correos',
        scheduleLabel: 'Todos los dias a las 08:00',
        workflowId: 'correo',
        workflowName: 'Correo',
      });

      agent.setWorkflowHubService({ savePassiveRule });
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Dame mis correos mas relevantes a las 8 am');

      expect(savePassiveRule).toHaveBeenCalledWith(expect.objectContaining({
        workflowId: 'correo',
        executionMode: 'agent_prompt',
        source: 'chat',
      }));
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('workflow pasivo'));
      expect(ctx.mockSendMessage).not.toHaveBeenCalled();
    });

    it('passes skipConfirmations=true when executing scheduled passive tasks', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      const { executeWhatsAppTools } = await import('../../whatsapp-tool-executor');
      vi.mocked(executeWhatsAppTools).mockResolvedValueOnce({
        responses: [{ functionResponse: { name: 'gmail_send', response: { success: true } } }],
        bulkLabelsToVerify: null,
      });

      ctx.mockSendMessage.mockResolvedValueOnce({
        response: {
          text: () => '',
          candidates: [{ content: { parts: [{ functionCall: { name: 'gmail_send', args: { to: 'a@b.com', subject: 'Hola', body: 'Texto' } } }] } }],
          functionCalls: () => null,
        },
      }).mockResolvedValueOnce({
        response: { text: () => 'Enviado', candidates: [{ content: { parts: [{ text: 'Enviado' }] } }], functionCalls: () => null },
      });

      await agent.handleScheduledTaskTrigger('123@s.whatsapp.net', '5215500000000', {
        id: 'task_1',
        cronExpression: '0 8 * * *',
        prompt: 'Envia un correo de seguimiento',
        phoneNumber: '5215500000000',
        createdAt: new Date().toISOString(),
      } as any);

      expect(executeWhatsAppTools).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ skipConfirmations: true }), '123@s.whatsapp.net', '5215500000000', false);
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', 'Enviado');
    });
  });
}
