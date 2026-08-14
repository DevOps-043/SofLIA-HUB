import { describe, expect, it, vi } from 'vitest';
import { createAgentWithService } from './create-agent';
import type { WhatsAppAgentTestContext } from './types';

export function registerPassiveSkillTests(ctx: WhatsAppAgentTestContext): void {
  describe('Skills pasivas', () => {
    it('detecta una peticion programada en lenguaje natural y la guarda como skill pasiva en vez de mandarla a Gemini', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      const saveRule = vi.fn().mockResolvedValue({
        id: 'task_1',
        name: 'Resumen de correos',
        scheduleLabel: 'Todos los dias a las 08:00',
        skillId: 'sistema:correo',
        skillName: 'Correo',
        channels: ['whatsapp'],
      });

      agent.setPassiveSkillsService({ saveRule } as any);
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Dame mis correos mas relevantes a las 8 am');

      expect(saveRule).toHaveBeenCalledWith(expect.objectContaining({
        skillId: 'sistema:correo',
        source: 'chat',
        // Sin canal pedido explicitamente se entrega por donde escribio.
        channels: ['whatsapp'],
      }));
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('skill pasiva'));
      expect(ctx.mockSendMessage).not.toHaveBeenCalled();
    });

    it('respeta el canal que el usuario pide explicitamente', async () => {
      const { agent } = createAgentWithService(ctx);
      const saveRule = vi.fn().mockResolvedValue({
        id: 'task_2',
        name: 'Rutina pasiva',
        scheduleLabel: 'Todos los dias a las 08:00',
        skillId: null,
        skillName: 'Rutina libre',
        channels: ['escritorio'],
      });

      agent.setPassiveSkillsService({ saveRule } as any);
      await agent.handleMessage(
        '123@s.whatsapp.net',
        '5215500000000',
        'Cada dia a las 8 am dame las noticias de IA en la computadora',
      );

      expect(saveRule).toHaveBeenCalledWith(expect.objectContaining({
        channels: ['escritorio'],
        // Sin canal de WhatsApp no se guarda telefono al que escribir.
        phoneNumber: '',
      }));
    });

    it('pasa skipConfirmations=true y DEVUELVE el texto en vez de enviarlo', async () => {
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

      const resultado = await agent.handleScheduledTaskTrigger('123@s.whatsapp.net', '5215500000000', {
        id: 'task_1',
        cronExpression: '0 8 * * *',
        prompt: 'Envia un correo de seguimiento',
        phoneNumber: '5215500000000',
        createdAt: new Date().toISOString(),
      } as any);

      expect(executeWhatsAppTools).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ skipConfirmations: true }), '123@s.whatsapp.net', '5215500000000', false);
      // El destino ya no se decide aqui: quien ejecuta devuelve el texto y la
      // capa de entrega lo reparte entre los canales de la regla.
      expect(resultado).toBe('Enviado');
      expect(waService.sendText).not.toHaveBeenCalled();
    });

    it('anade frescura y resultados anteriores al prompt de una rutina de noticias', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      waService.getConversationHistory.mockResolvedValueOnce([
        {
          timestamp: '2026-06-19T14:00:00.000Z',
          text: 'scheduled-task:news_1\nRespuesta enviada: Ayer mande una noticia sobre modelos multimodales.',
        },
      ]);
      ctx.mockTextResponse('Noticias frescas');

      const resultado = await agent.handleScheduledTaskTrigger('123@s.whatsapp.net', '5215500000000', {
        id: 'news_1',
        cronExpression: '0 8 * * *',
        prompt: 'Mandame noticias relevantes de IA',
        phoneNumber: '5215500000000',
        createdAt: new Date().toISOString(),
      } as any);

      expect(ctx.mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('FRESCURA OBLIGATORIA'));
      expect(ctx.mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('Ayer mande una noticia sobre modelos multimodales'));
      expect(ctx.mockSendMessage).toHaveBeenCalledWith(expect.stringContaining('Solicitud original: Mandame noticias relevantes de IA'));
      expect(resultado).toBe('Noticias frescas');
    });
  });
}
