import { describe, expect, it, vi } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';
import { createConnectedService } from './setup';

describe('WhatsApp Service - mensajes entrantes', () => {
  it('WA-022: emits message event for incoming text', async () => {
    const service = await createConnectedService();
    const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{ key: { remoteJid: '5215500000000@s.whatsapp.net', fromMe: false }, message: { conversation: 'Hola SofLIA' } }],
    });

    const msg = await msgPromise;
    expect(msg.text).toBe('Hola SofLIA');
    expect(msg.senderNumber).toBe('5215500000000');
    expect(msg.isGroup).toBe(false);
  });

  it('WA-023: group messages detected by @g.us JID', async () => {
    const service = await createConnectedService();
    const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{ key: { remoteJid: '120363000000@g.us', fromMe: false, participant: '5215500000000@s.whatsapp.net' }, message: { conversation: '/soflia hola' } }],
    });

    expect((await msgPromise).isGroup).toBe(true);
  });

  it('WA-024: fromMe messages are ignored', async () => {
    const service = await createConnectedService();
    const msgHandler = vi.fn();
    service.on('message', msgHandler);
    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{ key: { remoteJid: '5215500000000@s.whatsapp.net', fromMe: true }, message: { conversation: 'test' } }],
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(msgHandler).not.toHaveBeenCalled();
  });

  it('WA-025: status broadcast messages are ignored', async () => {
    const service = await createConnectedService();
    const msgHandler = vi.fn();
    service.on('message', msgHandler);
    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{ key: { remoteJid: 'status@broadcast', fromMe: false }, message: { conversation: 'status update' } }],
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(msgHandler).not.toHaveBeenCalled();
  });
});
