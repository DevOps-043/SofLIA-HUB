import { describe, expect, it, vi } from 'vitest';
import { executeWhatsAppTools, fc, makeCtx } from './fixture';

describe('Dispatch to delegated executors', () => {
  it('WA-105: dispatches iris_* tools to iris executor', async () => {
    const { executeIrisTool } = await import('../../whatsapp-executors/iris-executors');
    await executeWhatsAppTools([fc('iris_get_teams', {})], makeCtx(), 'jid', '5511111', false);
    expect(executeIrisTool).toHaveBeenCalledWith('iris_get_teams', {}, '5511111');
  });

  it('WA-106: dispatches gmail_send to google executor after confirmation', async () => {
    const { executeGoogleTool } = await import('../../whatsapp-executors/google-executors');
    await executeWhatsAppTools([fc('gmail_send', { to: 'x@y.com', subject: 'T', body: 'B' })], makeCtx({ requestConfirmation: vi.fn(async () => true) }), 'jid', '5511111', false);
    expect(executeGoogleTool).toHaveBeenCalled();
  });

  it('WA-106A: dispatches app_chat_get_context to app chat service', async () => {
    const { getAppChatConversationContext } = await import('../../app-chat-service');
    const result = await executeWhatsAppTools([fc('app_chat_get_context', { conversation_ref: 'base de datos', limit: 5 })], makeCtx(), 'jid', '5511111', false);
    expect(getAppChatConversationContext).toHaveBeenCalledWith('5511111', 'base de datos', 5);
    expect(result.responses[0].functionResponse.response.success).toBe(true);
  });

  it('WA-106B: app_chat_append_note is not blocked by protected-path keywords inside content', async () => {
    const { appendNoteToAppConversation } = await import('../../app-chat-service');
    const content = 'Anade Supabase y revisa src/services/chat-service.ts';
    const result = await executeWhatsAppTools([fc('app_chat_append_note', { conversation_ref: 'base de datos', content })], makeCtx(), 'jid', '5511111', false);
    expect(appendNoteToAppConversation).toHaveBeenCalledWith('5511111', 'base de datos', content);
    expect(result.responses[0].functionResponse.response.success).toBe(true);
  });

  it('WA-106C: app_chat_send_asset sends the prepared file by WhatsApp', async () => {
    const { prepareAppChatAssetForDelivery } = await import('../../app-chat-service');
    const sendFile = vi.fn(async () => {});
    const result = await executeWhatsAppTools([fc('app_chat_send_asset', { conversation_ref: 'base de datos', asset_ref: 'reporte.pdf', caption: 'Aqui va el reporte' })], makeCtx({ waService: { sendFile } as any }), 'jid', '5511111', false);
    expect(prepareAppChatAssetForDelivery).toHaveBeenCalledWith('5511111', 'base de datos', 'reporte.pdf', null);
    expect(sendFile).toHaveBeenCalledWith('jid', 'C:/tmp/reporte_pdf.pdf', 'Aqui va el reporte');
    expect(result.responses[0].functionResponse.response.success).toBe(true);
  });
});
