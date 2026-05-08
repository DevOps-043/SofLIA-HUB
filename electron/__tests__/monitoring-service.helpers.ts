import { vi } from 'vitest';
import {
  desktopCapturer,
  powerMonitor,
} from '../../test/mocks/electron';

export const mockActiveWin = vi.fn();
export const mockExtractTextFromFile = vi.fn();
export const mockExtractTextFromBase64 = vi.fn();
export const mockMkdir = vi.fn().mockResolvedValue(undefined);
export const mockWriteFile = vi.fn().mockResolvedValue(undefined);
export const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('fake-png'));
export const mockUnlink = vi.fn().mockResolvedValue(undefined);
export const mockReaddir = vi.fn().mockResolvedValue([]);
export const mockStat = vi.fn().mockResolvedValue({ mtimeMs: Date.now() });
export const mockSharpComposite = vi.fn().mockReturnThis();
export const mockSharpToBuffer = vi.fn().mockResolvedValue(Buffer.from('composited-png'));
export const mockSharpPng = vi.fn().mockReturnThis();
export const mockSharp = vi.fn(() => ({ composite: mockSharpComposite, toBuffer: mockSharpToBuffer, png: mockSharpPng }));

vi.mock('active-win', () => ({ default: mockActiveWin }));
vi.mock('../ocr-service', () => ({
  extractTextFromFile: (...args: any[]) => mockExtractTextFromFile(...args),
  extractTextFromBase64: (...args: any[]) => mockExtractTextFromBase64(...args),
}));
vi.mock('node:fs/promises', () => ({
  default: fsPromiseMock(),
  mkdir: (...a: any[]) => mockMkdir(...a),
  writeFile: (...a: any[]) => mockWriteFile(...a),
  readFile: (...a: any[]) => mockReadFile(...a),
  unlink: (...a: any[]) => mockUnlink(...a),
  readdir: (...a: any[]) => mockReaddir(...a),
  stat: (...a: any[]) => mockStat(...a),
}));
vi.mock('node:module', () => ({
  createRequire: () => (mod: string) => {
    if (mod === 'sharp') return mockSharp;
    throw new Error(`Module not found: ${mod}`);
  },
}));
export function getDesktopCapturerMock() {
  return desktopCapturer;
}

export function getPowerMonitorMock() {
  return powerMonitor;
}

export interface MonitoringStatus {
  isRunning: boolean;
  sessionId: string | null;
  userId: string | null;
  snapshotCount: number;
  config: { intervalSeconds: number; idleThresholdSeconds: number; screenshotEnabled: boolean; ocrEnabled: boolean };
  diagnostics?: { sharpAvailable: boolean; activeWinAvailable: boolean; screenshotFailCount: number; activeWinFailCount: number };
}

function fsPromiseMock() {
  return {
    mkdir: (...a: any[]) => mockMkdir(...a),
    writeFile: (...a: any[]) => mockWriteFile(...a),
    readFile: (...a: any[]) => mockReadFile(...a),
    unlink: (...a: any[]) => mockUnlink(...a),
    readdir: (...a: any[]) => mockReaddir(...a),
    stat: (...a: any[]) => mockStat(...a),
  };
}

export async function setupMonitoringTest() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  mockActiveWin.mockResolvedValue({ title: 'VS Code', owner: { name: 'Code.exe' }, url: undefined });
  (desktopCapturer.getSources as any).mockResolvedValue([{
    id: 'screen:0:0',
    name: 'Entire Screen',
    display_id: '0',
    thumbnail: {
      isEmpty: () => false,
      getSize: () => ({ width: 1280, height: 720 }),
      toPNG: () => Buffer.from('fake-png-data'),
      toDataURL: () => 'data:image/png;base64,iVBOR...',
    },
    appIcon: null,
  }]);
  (powerMonitor.getSystemIdleTime as any).mockReturnValue(0);
  mockExtractTextFromBase64.mockResolvedValue('');
  mockExtractTextFromFile.mockResolvedValue('Some OCR text');
  return (await import('../monitoring-service')).MonitoringService;
}

export function teardownMonitoringTest() {
  vi.useRealTimers();
}
