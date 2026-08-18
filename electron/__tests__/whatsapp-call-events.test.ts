import { describe, expect, it, vi } from 'vitest';
import * as waFixtures from './whatsapp-service.fixtures';
import { createConnectedService } from './whatsapp-service/setup';

/** Deja que el manejador asincrono del evento termine antes de comprobar. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

function emitCall(event: Record<string, unknown>): void {
  waFixtures.mockSockEvents.emit('call', [event]);
}

describe('WA-CALL: llamadas entrantes de WhatsApp', () => {
  it('rechaza el offer y lo reconduce al modo llamada', async () => {
    const service = await createConnectedService();
    await service.setAllowedNumbers([]);
    const offer = new Promise<any>((resolve) => service.on('call-offer', resolve));

    emitCall({ id: 'call-1', from: '5215500000000@s.whatsapp.net', status: 'offer', date: new Date() });

    const reconducida = await offer;
    expect(waFixtures.mockRejectCall).toHaveBeenCalledWith('call-1', '5215500000000@s.whatsapp.net');
    expect(reconducida.senderNumber).toBe('5215500000000');
  });

  it('no reconduce la llamada de un numero sin autorizacion, pero igual la rechaza', async () => {
    const service = await createConnectedService();
    await service.setAllowedNumbers(['5215511111111']);
    service.config.whitelistEnabled = true;
    const handler = vi.fn();
    service.on('call-offer', handler);

    emitCall({ id: 'call-2', from: '5215599999999@s.whatsapp.net', status: 'offer', date: new Date() });
    await settle();

    expect(waFixtures.mockRejectCall).toHaveBeenCalledWith('call-2', '5215599999999@s.whatsapp.net');
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignora los estados que no abren una llamada', async () => {
    const service = await createConnectedService();
    const handler = vi.fn();
    service.on('call-offer', handler);
    waFixtures.mockRejectCall.mockClear();

    for (const status of ['ringing', 'accept', 'terminate', 'reject', 'timeout']) {
      emitCall({ id: `call-${status}`, from: '5215500000000@s.whatsapp.net', status, date: new Date() });
    }
    await settle();

    expect(handler).not.toHaveBeenCalled();
    expect(waFixtures.mockRejectCall).not.toHaveBeenCalled();
  });

  it('rechaza la llamada a un grupo sin abrir sesion', async () => {
    const service = await createConnectedService();
    const handler = vi.fn();
    service.on('call-offer', handler);

    emitCall({ id: 'call-g', from: '120363000000@g.us', status: 'offer', isGroup: true, date: new Date() });
    await settle();

    expect(waFixtures.mockRejectCall).toHaveBeenCalledWith('call-g', '120363000000@g.us');
    expect(handler).not.toHaveBeenCalled();
  });

  // Regresion: WhatsApp multidispositivo entrega el offer con un LID, no con un
  // telefono. Tomarlo como numero lo dejaba fuera de la allowlist y la llamada
  // se descartaba como "sin autorizacion" sin abrir nunca el modo llamada.
  it('resuelve el LID con callerPn y reconduce la llamada', async () => {
    const service = await createConnectedService();
    await service.setAllowedNumbers([]);
    const offer = new Promise<any>((resolve) => service.on('call-offer', resolve));

    emitCall({
      id: 'call-lid',
      from: '149310259892439@lid',
      callerPn: '5215549476297@s.whatsapp.net',
      status: 'offer',
      date: new Date(),
    });

    const reconducida = await offer;
    expect(reconducida.senderNumber).toBe('5215549476297');
    expect(reconducida.jid).toBe('5215549476297@s.whatsapp.net');
  });

  it('resuelve el LID por el mapa de LIDs cuando no hay callerPn', async () => {
    const service = await createConnectedService();
    await service.setAllowedNumbers([]);
    waFixtures.mockGetPNForLID.mockResolvedValueOnce('5215549476297@s.whatsapp.net');
    const offer = new Promise<any>((resolve) => service.on('call-offer', resolve));

    emitCall({ id: 'call-lid-2', from: '149310259892439@lid', status: 'offer', date: new Date() });

    expect((await offer).senderNumber).toBe('5215549476297');
  });

  it('no abre sesion cuando el LID no se puede resolver a un telefono', async () => {
    const service = await createConnectedService();
    await service.setAllowedNumbers([]);
    waFixtures.mockGetPNForLID.mockResolvedValueOnce(undefined);
    const handler = vi.fn();
    service.on('call-offer', handler);

    emitCall({ id: 'call-lid-3', from: '149310259892439@lid', status: 'offer', date: new Date() });
    await settle();

    expect(waFixtures.mockRejectCall).toHaveBeenCalledWith('call-lid-3', '149310259892439@lid');
    expect(handler).not.toHaveBeenCalled();
  });

  it('registra la llamada rechazada en el historial', async () => {
    const service = await createConnectedService();
    await service.setAllowedNumbers([]);
    const historySpy = vi.spyOn(service, 'recordHistory');

    emitCall({ id: 'call-3', from: '5215500000000@s.whatsapp.net', status: 'offer', date: new Date() });
    await settle();

    expect(historySpy).toHaveBeenCalledWith(expect.objectContaining({
      direction: 'system',
      text: 'Llamada de voz entrante',
      metadata: expect.objectContaining({ callId: 'call-3', rejected: true }),
    }));
  });
});
