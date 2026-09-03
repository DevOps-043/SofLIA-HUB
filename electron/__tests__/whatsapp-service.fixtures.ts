import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

export const mockSockEvents = new EventEmitter();
export const mockSendMessage = vi.fn().mockResolvedValue(undefined);
export const mockLogout = vi.fn().mockResolvedValue(undefined);
export const mockRejectCall = vi.fn().mockResolvedValue(undefined);
export const mockGetPNForLID = vi.fn();
export const mockUpdateMediaMessage = vi.fn();
export const mockFsMkdir = vi.fn().mockResolvedValue(undefined);
export const mockFsReadFile = vi.fn().mockRejectedValue(new Error('ENOENT'));
export const mockFsWriteFile = vi.fn().mockResolvedValue(undefined);
export const mockFsAppendFile = vi.fn().mockResolvedValue(undefined);
export const mockFsRm = vi.fn().mockResolvedValue(undefined);
export const mockFsStat = vi.fn().mockResolvedValue({ size: 1024 });

/** LID del bot: en un grupo con identidad oculta las menciones llegan asi. */
export const BOT_LID_USER = '778899001122';

const mockSock = {
  ev: mockSockEvents,
  sendMessage: mockSendMessage,
  logout: mockLogout,
  rejectCall: mockRejectCall,
  user: { id: '5215512345678:0@s.whatsapp.net', lid: `${BOT_LID_USER}:0@lid` },
  updateMediaMessage: mockUpdateMediaMessage,
  signalRepository: { lidMapping: { getPNForLID: mockGetPNForLID } },
};

const mockSaveCreds = vi.fn();

vi.mock('@whiskeysockets/baileys', () => ({
  default: vi.fn(() => mockSock),
  useMultiFileAuthState: vi.fn().mockResolvedValue({ state: { creds: {}, keys: {} }, saveCreds: mockSaveCreds }),
  fetchLatestBaileysVersion: vi.fn().mockResolvedValue({ version: [2, 2413, 1] }),
  makeCacheableSignalKeyStore: vi.fn((_keys: any) => _keys),
  downloadMediaMessage: vi.fn().mockResolvedValue(Buffer.from('test-media')),
  DisconnectReason: {
    loggedOut: 401,
    connectionClosed: 428,
    connectionLost: 408,
    timedOut: 408,
    connectionReplaced: 440,
    badSession: 500,
    restartRequired: 515,
    multideviceMismatch: 411,
  },
}));

vi.mock('pino', () => ({ default: vi.fn(() => ({ level: 'silent' })) }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QRCODE') } }));
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mockFsMkdir,
    readFile: mockFsReadFile,
    writeFile: mockFsWriteFile,
    appendFile: mockFsAppendFile,
    rm: mockFsRm,
    stat: mockFsStat,
  },
}));
