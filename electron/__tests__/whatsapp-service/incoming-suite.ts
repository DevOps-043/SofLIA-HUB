import { describe, expect, it, vi } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';
import { createConnectedService } from './setup';

describe('WhatsApp Service - mensajes entrantes', () => {
  it('WA-022: emits message event for incoming text', async () => {
    const service = await createConnectedService();
    const historySpy = vi.spyOn(service, 'recordHistory');
    const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{ key: { remoteJid: '5215500000000@s.whatsapp.net', fromMe: false }, message: { conversation: 'Hola Pulse' } }],
    });

    const msg = await msgPromise;
    expect(msg.text).toBe('Hola Pulse');
    expect(msg.senderNumber).toBe('5215500000000');
    expect(msg.isGroup).toBe(false);
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'incoming',
      kind: 'text',
      text: 'Hola Pulse',
      senderNumber: '5215500000000',
    }));
  });

  it('WA-023: group messages detected by @g.us JID', async () => {
    const service = await createConnectedService();
    await service.setGroupConfig({ groupPolicy: 'open' });
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

  it('WA-025b: sticker-only messages are recorded but not emitted to the agent', async () => {
    const service = await createConnectedService();
    const msgHandler = vi.fn();
    const historySpy = vi.spyOn(service, 'recordHistory');
    service.on('message', msgHandler);

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: { remoteJid: '5215500000000@s.whatsapp.net', fromMe: false, id: 'msg-sticker-1' },
        message: { stickerMessage: { mimetype: 'image/webp' } },
      }],
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(msgHandler).not.toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'incoming',
      kind: 'media',
      text: 'Sticker recibido',
      metadata: expect.objectContaining({ passiveInteraction: 'sticker', ignoredByAgent: true }),
    }));
  });

  it('WA-025c: reaction messages are recorded but not emitted to the agent', async () => {
    const service = await createConnectedService();
    const msgHandler = vi.fn();
    const historySpy = vi.spyOn(service, 'recordHistory');
    service.on('message', msgHandler);

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: { remoteJid: '5215500000000@s.whatsapp.net', fromMe: false, id: 'msg-reaction-1' },
        message: { reactionMessage: { text: '❤️' } },
      }],
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(msgHandler).not.toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'incoming',
      kind: 'text',
      text: 'Reaccion recibida: ❤️',
      metadata: expect.objectContaining({ passiveInteraction: 'reaction', ignoredByAgent: true }),
    }));
  });

  it('WA-026: records incoming media metadata without storing buffer content', async () => {
    const service = await createConnectedService();
    const historySpy = vi.spyOn(service, 'recordHistory');
    const mediaPromise = new Promise<any>(resolve => service.on('media', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: { remoteJid: '5215500000000@s.whatsapp.net', fromMe: false, id: 'msg-media-1' },
        message: { imageMessage: { mimetype: 'image/jpeg', caption: 'foto de prueba' } },
      }],
    });

    await mediaPromise;
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'incoming',
      kind: 'media',
      text: 'foto de prueba',
      media: expect.objectContaining({ fileName: 'image.jpg', mimetype: 'image/jpeg' }),
    }));
  });
});
