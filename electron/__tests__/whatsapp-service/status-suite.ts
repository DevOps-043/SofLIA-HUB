import { describe, expect, it } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';
import { createConnectedService, createService } from './setup';

describe('WhatsApp Service - estado y configuracion', () => {
  it('WA-011: logout clears credentials', async () => {
    const fs = (await import('node:fs/promises')).default;
    await createConnectedService();
    waFixtures.mockSockEvents.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(fs.rm).toHaveBeenCalled();
  });

  it('WA-012: creds.update persists credentials listener', async () => {
    await createConnectedService();
    expect(waFixtures.mockSockEvents.listeners('creds.update').length).toBeGreaterThan(0);
  });

  it('WA-013: getStatus returns correct structure', () => {
    const status = createService().getStatus();
    for (const key of ['connected', 'phoneNumber', 'qr', 'groupPolicy', 'groupActivation', 'groupPrefix', 'allowedNumbers']) {
      expect(status).toHaveProperty(key);
    }
  });

  it('WA-026: disconnect calls logout and resets state', async () => {
    const service = await createConnectedService();
    waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
    await new Promise(resolve => setTimeout(resolve, 10));
    await service.disconnect();
    expect(waFixtures.mockLogout).toHaveBeenCalled();
    expect(service.isConnected()).toBe(false);
  });

  it('WA-027: isConnected returns correct boolean', () => {
    expect(createService().isConnected()).toBe(false);
  });

  it('WA-028: setAllowedNumbers updates config', async () => {
    const service = createService();
    await service.init();
    await service.setAllowedNumbers(['5215500000000']);
    expect(service.getStatus().allowedNumbers).toEqual(['5215500000000']);
  });

  it('WA-029: isAllowedNumber matches variants and open access', async () => {
    const service = createService();
    await service.init();
    await service.setAllowedNumbers(['5215512345678']);
    expect(service.isAllowedNumber('5512345678')).toBe(true);
    expect(createService().isAllowedNumber('anyNumber')).toBe(true);
  });
});
