import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';
import { createConnectedService, createService } from './setup';

describe('WhatsApp Service - conexion', () => {
  it('WA-001: service is an EventEmitter', () => {
    expect(createService()).toBeInstanceOf(EventEmitter);
  });

  it('WA-002: init loads config without error', async () => {
    await expect(createService().init()).resolves.not.toThrow();
  });

  it('WA-003: connect creates socket', async () => {
    const makeWASocket = (await import('@whiskeysockets/baileys')).default;
    await createConnectedService();
    expect(makeWASocket).toHaveBeenCalled();
  });

  it('WA-004: connect uses auth state', async () => {
    const { useMultiFileAuthState } = await import('@whiskeysockets/baileys');
    await createConnectedService();
    expect(useMultiFileAuthState).toHaveBeenCalled();
  });

  it('WA-005: connect fetches Baileys version', async () => {
    const { fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys');
    await createConnectedService();
    expect(fetchLatestBaileysVersion).toHaveBeenCalled();
  });

  it('WA-006: emits qr event when QR is received from Baileys', async () => {
    const service = await createConnectedService();
    const qrPromise = new Promise<string>(resolve => service.on('qr', resolve));
    waFixtures.mockSockEvents.emit('connection.update', { qr: 'test-qr-data' });
    expect(await qrPromise).toBe('data:image/png;base64,QRCODE');
  });

  it('WA-007: emits connected when connection opens', async () => {
    const service = await createConnectedService();
    const connPromise = new Promise<string>(resolve => service.on('connected', resolve));
    waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
    expect(await connPromise).toBe('5215512345678');
  });

  it('WA-008: getStatus reflects connected state after open', async () => {
    const service = await createConnectedService();
    waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(service.getStatus()).toMatchObject({ connected: true, phoneNumber: '5215512345678' });
  });

  it('WA-009: emits disconnected when connection closes', async () => {
    const service = await createConnectedService();
    const discPromise = new Promise<number>(resolve => service.on('disconnected', resolve));
    waFixtures.mockSockEvents.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 428 } } } });
    expect(await discPromise).toBe(428);
  });

  it('WA-010: schedules reconnect after non-logout disconnect', async () => {
    vi.useFakeTimers();
    const service = await createConnectedService();
    const connectSpy = vi.spyOn(service, 'connect');
    waFixtures.mockSockEvents.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 428 } } } });
    vi.advanceTimersByTime(3000);
    expect(connectSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
