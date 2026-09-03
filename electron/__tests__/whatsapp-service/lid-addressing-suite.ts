import { describe, expect, it, vi } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';
import { createConnectedService } from './setup';

const PHONE = '5215500000000';
const SENDER_LID = '184739201928374@lid';

function activeHubStub() {
  return {
    resolvePrincipalFromWhatsApp: vi.fn().mockResolvedValue({
      active: true,
      role: 'owner',
      capabilities: ['personal_agent'],
    }),
  };
}

describe('WhatsApp Service - direccionamiento oculto (LID)', () => {
  it('WA-040: un directo en modo LID resuelve el telefono desde remoteJidAlt', async () => {
    const service = await createConnectedService();
    const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: {
          remoteJid: SENDER_LID,
          remoteJidAlt: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
          id: 'lid-dm-1',
        },
        message: { conversation: 'Hola desde un chat con identidad oculta' },
      }],
    });

    const msg = await msgPromise;
    expect(msg.senderNumber).toBe(PHONE);
    expect(msg.text).toBe('Hola desde un chat con identidad oculta');
  });

  it('WA-041: sin remoteJidAlt se consulta el mapa inverso de LIDs', async () => {
    const service = await createConnectedService();
    waFixtures.mockGetPNForLID.mockResolvedValue(`${PHONE}:0@s.whatsapp.net`);
    const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: { remoteJid: SENDER_LID, fromMe: false, id: 'lid-dm-2' },
        message: { conversation: 'Sin alt en el sobre' },
      }],
    });

    expect((await msgPromise).senderNumber).toBe(PHONE);
    expect(waFixtures.mockGetPNForLID).toHaveBeenCalledWith(SENDER_LID);
  });

  it('WA-042: la identidad SOFIA se resuelve con el telefono, nunca con el LID', async () => {
    const service = await createConnectedService();
    const hub = activeHubStub();
    service.setCommunicationHubService(hub as any);
    const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: {
          remoteJid: SENDER_LID,
          remoteJidAlt: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
          id: 'lid-dm-3',
        },
        message: { conversation: 'Necesito una respuesta' },
      }],
    });

    await msgPromise;
    expect(hub.resolvePrincipalFromWhatsApp).toHaveBeenCalledWith(PHONE);
  });

  it('WA-043: un LID sin telefono resoluble se descarta dejando el motivo en el historial', async () => {
    const service = await createConnectedService();
    service.setCommunicationHubService(activeHubStub() as any);
    waFixtures.mockGetPNForLID.mockResolvedValue(null);
    const historySpy = vi.spyOn(service, 'recordHistory');
    const msgHandler = vi.fn();
    service.on('message', msgHandler);

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: { remoteJid: SENDER_LID, fromMe: false, id: 'lid-dm-4' },
        message: { conversation: 'Nadie sabe quien soy' },
      }],
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(msgHandler).not.toHaveBeenCalled();
    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'system',
      metadata: expect.objectContaining({ lidUnresolved: true }),
    }));
  });

  it('WA-044: en grupo el telefono sale de participantAlt', async () => {
    const service = await createConnectedService();
    await service.setGroupConfig({ groupPolicy: 'open' });
    const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: {
          remoteJid: '120363000000@g.us',
          participant: SENDER_LID,
          participantAlt: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
          id: 'lid-group-1',
        },
        message: { conversation: '/soflia hola' },
      }],
    });

    const msg = await msgPromise;
    expect(msg.isGroup).toBe(true);
    expect(msg.senderNumber).toBe(PHONE);
  });

  it('WA-045: una mencion al bot por su LID activa la respuesta en grupo', async () => {
    const service = await createConnectedService();
    await service.setGroupConfig({ groupPolicy: 'open' });
    const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

    waFixtures.mockSockEvents.emit('messages.upsert', {
      messages: [{
        key: {
          remoteJid: '120363000000@g.us',
          participant: SENDER_LID,
          participantAlt: `${PHONE}@s.whatsapp.net`,
          fromMe: false,
          id: 'lid-group-2',
        },
        message: {
          extendedTextMessage: {
            text: `@${waFixtures.BOT_LID_USER} revisa esto`,
            contextInfo: { mentionedJid: [`${waFixtures.BOT_LID_USER}@lid`] },
          },
        },
      }],
    });

    const msg = await msgPromise;
    expect(msg.text).toBe('revisa esto');
  });
});
