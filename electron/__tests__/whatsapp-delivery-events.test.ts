import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { registerDeliveryEvents } from '../whatsapp/delivery-events';
import type { WhatsAppServiceCore } from '../whatsapp/types';

describe('eventos de entrega de WhatsApp', () => {
  it('acepta estados nulos del protocolo y sólo registra errores explícitos', () => {
    const events = new EventEmitter();
    const service = { sock: { ev: events }, recordHistory: vi.fn(), emit: vi.fn(), getStatus: vi.fn(() => ({})), lastDeliveryError: null };
    registerDeliveryEvents(service as unknown as WhatsAppServiceCore);
    events.emit('messages.update', [{ key: { id: null }, update: { status: null } }, { update: { status: 3 } }]);
    expect(service.recordHistory).not.toHaveBeenCalled();
    events.emit('messages.update', [{ key: { id: null, remoteJid: 'prueba@s.whatsapp.net' }, update: { status: 0, messageStubParameters: ['403'] } }]);
    expect(service.recordHistory).toHaveBeenCalledWith(expect.objectContaining({ metadata: { messageId: undefined, deliveryErrorCode: '403', deliveryFailed: true } }));
    expect(service.emit).toHaveBeenCalledWith('delivery-error', expect.objectContaining({ code: '403' }));
  });
});
