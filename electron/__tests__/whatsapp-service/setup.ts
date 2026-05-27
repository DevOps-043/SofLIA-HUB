import { afterEach, beforeEach, vi } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';

let WhatsAppService: any;

beforeEach(async () => {
  vi.clearAllMocks();
  waFixtures.mockSockEvents.removeAllListeners();
  waFixtures.mockFsMkdir.mockResolvedValue(undefined);
  waFixtures.mockFsReadFile.mockRejectedValue(new Error('ENOENT'));
  waFixtures.mockFsWriteFile.mockResolvedValue(undefined);
  waFixtures.mockFsAppendFile.mockResolvedValue(undefined);
  waFixtures.mockFsRm.mockResolvedValue(undefined);
  waFixtures.mockFsStat.mockResolvedValue({ size: 1024 } as any);
  const mod = await import('../../whatsapp-service');
  WhatsAppService = mod.WhatsAppService;
});

afterEach(() => {
  vi.restoreAllMocks();
});

export function createService(): any {
  return new WhatsAppService();
}

export async function createConnectedService(): Promise<any> {
  const service = new WhatsAppService();
  await service.init();
  await service.connect();
  return service;
}
