import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import * as waFixtures from './whatsapp-service.fixtures';

// ============================================================================
// WhatsApp Service Tests (WA-001 to WA-030)
// Tests for electron/whatsapp-service.ts â€” connection, QR, messaging,
// reconnect, auth, group detection, jailbreak detection, and status.
// ============================================================================


// Import the service after mocks are set up
let WhatsAppService: any;

beforeEach(async () => {
  vi.clearAllMocks();
  waFixtures.mockSockEvents.removeAllListeners();
  waFixtures.mockFsMkdir.mockResolvedValue(undefined);
  waFixtures.mockFsReadFile.mockRejectedValue(new Error('ENOENT'));
  waFixtures.mockFsWriteFile.mockResolvedValue(undefined);
  waFixtures.mockFsRm.mockResolvedValue(undefined);
  waFixtures.mockFsStat.mockResolvedValue({ size: 1024 } as any);
  const mod = await import('../whatsapp-service');
  WhatsAppService = mod.WhatsAppService;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: create a service, init, and connect
async function createConnectedService() {
  const service = new WhatsAppService();
  await service.init();
  await service.connect();
  return service;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('WhatsApp Service', () => {
  // --------------------------------------------------------------------------
  // WA-001: Service is an EventEmitter
  // --------------------------------------------------------------------------
  describe('WA-001: Service extends EventEmitter', () => {
    it('should be an instance of EventEmitter', () => {
      const service = new WhatsAppService();
      expect(service).toBeInstanceOf(EventEmitter);
    });
  });

  // --------------------------------------------------------------------------
  // WA-002: init() loads config without error
  // --------------------------------------------------------------------------
  describe('WA-002: init loads config', () => {
    it('should initialize without throwing', async () => {
      const service = new WhatsAppService();
      await expect(service.init()).resolves.not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // WA-003: connect() creates socket via makeWASocket
  // --------------------------------------------------------------------------
  describe('WA-003: connect creates socket', () => {
    it('should call makeWASocket during connect', async () => {
      const makeWASocket = (await import('@whiskeysockets/baileys')).default;
      await createConnectedService();
      expect(makeWASocket).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // WA-004: connect() calls useMultiFileAuthState for credential persistence
  // --------------------------------------------------------------------------
  describe('WA-004: connect uses auth state', () => {
    it('should call useMultiFileAuthState', async () => {
      const { useMultiFileAuthState } = await import('@whiskeysockets/baileys');
      await createConnectedService();
      expect(useMultiFileAuthState).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // WA-005: connect() calls fetchLatestBaileysVersion
  // --------------------------------------------------------------------------
  describe('WA-005: connect fetches Baileys version', () => {
    it('should call fetchLatestBaileysVersion', async () => {
      const { fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys');
      await createConnectedService();
      expect(fetchLatestBaileysVersion).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // WA-006: QR event emitted when connection.update provides QR
  // --------------------------------------------------------------------------
  describe('WA-006: QR code emission', () => {
    it('should emit qr event when QR is received from Baileys', async () => {
      const service = await createConnectedService();
      const qrPromise = new Promise<string>(resolve => service.on('qr', resolve));
      waFixtures.mockSockEvents.emit('connection.update', { qr: 'test-qr-data' });
      const qrDataUrl = await qrPromise;
      expect(qrDataUrl).toBe('data:image/png;base64,QRCODE');
    });
  });

  // --------------------------------------------------------------------------
  // WA-007: Connected event emitted on connection open
  // --------------------------------------------------------------------------
  describe('WA-007: connected event on open', () => {
    it('should emit connected when connection opens', async () => {
      const service = await createConnectedService();
      const connPromise = new Promise<string>(resolve => service.on('connected', resolve));
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      const phone = await connPromise;
      expect(phone).toBe('5215512345678');
    });
  });

  // --------------------------------------------------------------------------
  // WA-008: Status reflects connected state after open
  // --------------------------------------------------------------------------
  describe('WA-008: getStatus reflects connected state', () => {
    it('should return connected: true after connection open', async () => {
      const service = await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      // Allow event handler to run
      await new Promise(r => setTimeout(r, 10));
      const status = service.getStatus();
      expect(status.connected).toBe(true);
      expect(status.phoneNumber).toBe('5215512345678');
    });
  });

  // --------------------------------------------------------------------------
  // WA-009: Disconnected event emitted on connection close
  // --------------------------------------------------------------------------
  describe('WA-009: disconnected event on close', () => {
    it('should emit disconnected when connection closes', async () => {
      const service = await createConnectedService();
      const discPromise = new Promise<number>(resolve => service.on('disconnected', resolve));
      waFixtures.mockSockEvents.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 428 } } },
      });
      const code = await discPromise;
      expect(code).toBe(428);
    });
  });

  // --------------------------------------------------------------------------
  // WA-010: Auto-reconnect with exponential backoff on non-logout disconnect
  // --------------------------------------------------------------------------
  describe('WA-010: auto-reconnect on non-logout disconnect', () => {
    it('should schedule reconnect after non-logout disconnect', async () => {
      vi.useFakeTimers();
      const service = await createConnectedService();
      const connectSpy = vi.spyOn(service, 'connect');
      waFixtures.mockSockEvents.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 428 } } },
      });
      // Advance past the first reconnect delay (2^1 * 1000 = 2000ms)
      vi.advanceTimersByTime(3000);
      // connect should have been called for reconnect
      expect(connectSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // --------------------------------------------------------------------------
  // WA-011: Logout clears auth directory and disables autoConnect
  // --------------------------------------------------------------------------
  describe('WA-011: logout clears credentials', () => {
    it('should call fs.rm on auth dir when disconnect reason is loggedOut', async () => {
      const fs = (await import('node:fs/promises')).default;
      await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 401 } } },
      });
      await new Promise(r => setTimeout(r, 10));
      expect(fs.rm).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // WA-012: Credentials update calls saveCreds
  // --------------------------------------------------------------------------
  describe('WA-012: creds.update persists credentials', () => {
    it('should register listener for creds.update', async () => {
      await createConnectedService();
      // The socket event handler for creds.update should be registered
      const listeners = waFixtures.mockSockEvents.listeners('creds.update');
      expect(listeners.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // WA-013: getStatus returns expected shape
  // --------------------------------------------------------------------------
  describe('WA-013: getStatus returns correct structure', () => {
    it('should return object with connected, phoneNumber, qr, and group fields', () => {
      const service = new WhatsAppService();
      const status = service.getStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('phoneNumber');
      expect(status).toHaveProperty('qr');
      expect(status).toHaveProperty('groupPolicy');
      expect(status).toHaveProperty('groupActivation');
      expect(status).toHaveProperty('groupPrefix');
      expect(status).toHaveProperty('allowedNumbers');
    });
  });

  // --------------------------------------------------------------------------
  // WA-014: sendText sends text message via socket
  // --------------------------------------------------------------------------
  describe('WA-014: sendText sends text', () => {
    it('should call sock.sendMessage with text payload', async () => {
      const service = await createConnectedService();
      // Simulate connected state
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      await service.sendText('5215500000000@s.whatsapp.net', 'Hola mundo');
      expect(waFixtures.mockSendMessage).toHaveBeenCalledWith(
        '5215500000000@s.whatsapp.net',
        { text: 'Hola mundo' },
      );
    });
  });

  // --------------------------------------------------------------------------
  // WA-015: sendText throws when not connected
  // --------------------------------------------------------------------------
  describe('WA-015: sendText throws when disconnected', () => {
    it('should throw error if not connected', async () => {
      const service = new WhatsAppService();
      await service.init();
      await expect(service.sendText('123@s.whatsapp.net', 'test')).rejects.toThrow(
        'WhatsApp no estÃ¡ conectado',
      );
    });
  });

  // --------------------------------------------------------------------------
  // WA-016: sendText to group JID works
  // --------------------------------------------------------------------------
  describe('WA-016: sendText to group', () => {
    it('should send text to a group JID (@g.us)', async () => {
      const service = await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      await service.sendText('120363000000@g.us', 'Mensaje al grupo');
      expect(waFixtures.mockSendMessage).toHaveBeenCalledWith('120363000000@g.us', {
        text: 'Mensaje al grupo',
      });
    });
  });

  // --------------------------------------------------------------------------
  // WA-017: sendText splits long messages (> 4000 chars)
  // --------------------------------------------------------------------------
  describe('WA-017: sendText splits long messages', () => {
    it('should split messages longer than 4000 characters', async () => {
      const service = await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      const longText = 'A'.repeat(5000);
      await service.sendText('123@s.whatsapp.net', longText);
      expect(waFixtures.mockSendMessage).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // WA-018: sendFile sends image for .jpg extension
  // --------------------------------------------------------------------------
  describe('WA-018: sendFile sends image for jpg', () => {
    it('should send image message for .jpg files', async () => {
      const service = await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      waFixtures.mockFsReadFile.mockResolvedValue(Buffer.from('fake-image'));
      waFixtures.mockFsStat.mockResolvedValue({ size: 1024 } as any);
      await service.sendFile('123@s.whatsapp.net', '/tmp/photo.jpg', 'Mi foto');
      expect(waFixtures.mockSendMessage).toHaveBeenCalledWith(
        '123@s.whatsapp.net',
        expect.objectContaining({ image: expect.any(Buffer), mimetype: 'image/jpeg' }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // WA-019: sendFile sends document for non-image/video files
  // --------------------------------------------------------------------------
  describe('WA-019: sendFile sends document for pdf', () => {
    it('should send document message for .pdf files', async () => {
      const service = await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      waFixtures.mockFsReadFile.mockResolvedValue(Buffer.from('fake-pdf'));
      waFixtures.mockFsStat.mockResolvedValue({ size: 1024 } as any);
      await service.sendFile('123@s.whatsapp.net', '/tmp/report.pdf');
      expect(waFixtures.mockSendMessage).toHaveBeenCalledWith(
        '123@s.whatsapp.net',
        expect.objectContaining({ document: expect.any(Buffer), fileName: 'report.pdf' }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // WA-020: sendFile sends video for .mp4 extension
  // --------------------------------------------------------------------------
  describe('WA-020: sendFile sends video for mp4', () => {
    it('should send video message for .mp4 files', async () => {
      const service = await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      waFixtures.mockFsReadFile.mockResolvedValue(Buffer.from('fake-video'));
      waFixtures.mockFsStat.mockResolvedValue({ size: 1024 } as any);
      await service.sendFile('123@s.whatsapp.net', '/tmp/video.mp4');
      expect(waFixtures.mockSendMessage).toHaveBeenCalledWith(
        '123@s.whatsapp.net',
        expect.objectContaining({ video: expect.any(Buffer), mimetype: 'video/mp4' }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // WA-021: sendFile throws for oversized files (> 16 MB)
  // --------------------------------------------------------------------------
  describe('WA-021: sendFile rejects oversized files', () => {
    it('should throw for files larger than 16 MB', async () => {
      const service = await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      waFixtures.mockFsStat.mockResolvedValue({ size: 20 * 1024 * 1024 } as any);
      await expect(service.sendFile('123@s.whatsapp.net', '/tmp/huge.zip')).rejects.toThrow(
        'demasiado grande',
      );
    });
  });

  // --------------------------------------------------------------------------
  // WA-022: Message event emitted for text messages
  // --------------------------------------------------------------------------
  describe('WA-022: message event for incoming text', () => {
    it('should emit message event when text message arrives', async () => {
      const service = await createConnectedService();
      const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

      waFixtures.mockSockEvents.emit('messages.upsert', {
        messages: [
          {
            key: { remoteJid: '5215500000000@s.whatsapp.net', fromMe: false },
            message: { conversation: 'Hola SofLIA' },
          },
        ],
      });

      const msg = await msgPromise;
      expect(msg.text).toBe('Hola SofLIA');
      expect(msg.senderNumber).toBe('5215500000000');
      expect(msg.isGroup).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // WA-023: Group messages detected by @g.us JID
  // --------------------------------------------------------------------------
  describe('WA-023: group message detection', () => {
    it('should set isGroup true for @g.us JID', async () => {
      const service = await createConnectedService();
      // Group messages need activation â€” use /soflia prefix
      const msgPromise = new Promise<any>(resolve => service.on('message', resolve));

      waFixtures.mockSockEvents.emit('messages.upsert', {
        messages: [
          {
            key: {
              remoteJid: '120363000000@g.us',
              fromMe: false,
              participant: '5215500000000@s.whatsapp.net',
            },
            message: { conversation: '/soflia hola' },
          },
        ],
      });

      const msg = await msgPromise;
      expect(msg.isGroup).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // WA-024: fromMe messages are ignored
  // --------------------------------------------------------------------------
  describe('WA-024: fromMe messages ignored', () => {
    it('should not emit message event for own messages', async () => {
      const service = await createConnectedService();
      const msgHandler = vi.fn();
      service.on('message', msgHandler);

      waFixtures.mockSockEvents.emit('messages.upsert', {
        messages: [
          {
            key: { remoteJid: '5215500000000@s.whatsapp.net', fromMe: true },
            message: { conversation: 'test' },
          },
        ],
      });

      await new Promise(r => setTimeout(r, 50));
      expect(msgHandler).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // WA-025: Status broadcast messages are ignored
  // --------------------------------------------------------------------------
  describe('WA-025: status broadcast ignored', () => {
    it('should not emit message for status@broadcast', async () => {
      const service = await createConnectedService();
      const msgHandler = vi.fn();
      service.on('message', msgHandler);

      waFixtures.mockSockEvents.emit('messages.upsert', {
        messages: [
          {
            key: { remoteJid: 'status@broadcast', fromMe: false },
            message: { conversation: 'status update' },
          },
        ],
      });

      await new Promise(r => setTimeout(r, 50));
      expect(msgHandler).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // WA-026: disconnect() calls logout and resets state
  // --------------------------------------------------------------------------
  describe('WA-026: disconnect calls logout', () => {
    it('should call sock.logout and reset state', async () => {
      const service = await createConnectedService();
      waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      await service.disconnect();
      expect(waFixtures.mockLogout).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // WA-027: isConnected() returns boolean
  // --------------------------------------------------------------------------
  describe('WA-027: isConnected returns correct boolean', () => {
    it('should return false initially', () => {
      const service = new WhatsAppService();
      expect(service.isConnected()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // WA-028: setAllowedNumbers updates config
  // --------------------------------------------------------------------------
  describe('WA-028: setAllowedNumbers updates config', () => {
    it('should update allowed numbers list', async () => {
      const service = new WhatsAppService();
      await service.init();
      await service.setAllowedNumbers(['5215500000000']);
      const status = service.getStatus();
      expect(status.allowedNumbers).toEqual(['5215500000000']);
    });
  });

  // --------------------------------------------------------------------------
  // WA-029: isAllowedNumber matches with country code variations
  // --------------------------------------------------------------------------
  describe('WA-029: isAllowedNumber matches variants', () => {
    it('should match when last 10 digits are the same', async () => {
      const service = new WhatsAppService();
      await service.init();
      await service.setAllowedNumbers(['5215512345678']);
      expect(service.isAllowedNumber('5512345678')).toBe(true);
    });

    it('should return true when no numbers are configured (open access)', () => {
      const service = new WhatsAppService();
      expect(service.isAllowedNumber('anyNumber')).toBe(true);
    });
  });
});
