import { afterEach, beforeEach, vi } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';

let WhatsAppService: any;
let services: Array<{ disconnect(): Promise<void> }> = [];

beforeEach(async () => {
  services = [];
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

afterEach(async () => {
  vi.useRealTimers();
  for (const service of services) await service.disconnect();
  vi.restoreAllMocks();
});

export function createService(): any {
  const service = new WhatsAppService();
  services.push(service);
  return service;
}

export async function createConnectedService(): Promise<any> {
  const service = createService();
  await service.init();
  await service.connect();
  return service;
}
