import { describe, expect, it, vi } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';
import { createConnectedService, createService } from './setup';

describe('WhatsApp Service - mensajes salientes', () => {
  async function connectedService() {
    const service = await createConnectedService();
    waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
    await new Promise(resolve => setTimeout(resolve, 10));
    return service;
  }

  it('WA-014: sendText sends text payload', async () => {
    const service = await connectedService();
    const historySpy = vi.spyOn(service, 'recordHistory');
    await service.sendText('5215500000000@s.whatsapp.net', 'Hola mundo');
    expect(waFixtures.mockSendMessage).toHaveBeenCalledWith('5215500000000@s.whatsapp.net', { text: 'Hola mundo' });
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'outgoing',
      kind: 'text',
      text: 'Hola mundo',
      senderNumber: '5215500000000',
    }));
  });

  it('WA-015: sendText throws when disconnected', async () => {
    const service = createService();
    await service.init();
    await expect(service.sendText('123@s.whatsapp.net', 'test')).rejects.toThrow('WhatsApp no esta conectado');
  });

  it('WA-016: sendText to group JID works', async () => {
    const service = await connectedService();
    await service.sendText('120363000000@g.us', 'Mensaje al grupo');
    expect(waFixtures.mockSendMessage).toHaveBeenCalledWith('120363000000@g.us', { text: 'Mensaje al grupo' });
  });

  it('WA-017: sendText splits long messages', async () => {
    const service = await connectedService();
    const historySpy = vi.spyOn(service, 'recordHistory');
    await service.sendText('123@s.whatsapp.net', 'A'.repeat(5000));
    expect(waFixtures.mockSendMessage).toHaveBeenCalledTimes(2);
    expect(historySpy).toHaveBeenCalledTimes(2);
    expect(historySpy).toHaveBeenLastCalledWith(expect.objectContaining({
      metadata: { part: 2, totalParts: 2 },
    }));
  });
});
