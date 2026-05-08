import { describe, expect, it } from 'vitest';
import * as waFixtures from '../whatsapp-service.fixtures';
import { createConnectedService } from './setup';

describe('WhatsApp Service - archivos', () => {
  async function connectedService() {
    const service = await createConnectedService();
    waFixtures.mockSockEvents.emit('connection.update', { connection: 'open' });
    await new Promise(resolve => setTimeout(resolve, 10));
    waFixtures.mockFsStat.mockResolvedValue({ size: 1024 } as any);
    return service;
  }

  it('WA-018: sendFile sends image for jpg', async () => {
    const service = await connectedService();
    waFixtures.mockFsReadFile.mockResolvedValue(Buffer.from('fake-image'));
    await service.sendFile('123@s.whatsapp.net', '/tmp/photo.jpg', 'Mi foto');
    expect(waFixtures.mockSendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', expect.objectContaining({ image: expect.any(Buffer), mimetype: 'image/jpeg' }));
  });

  it('WA-019: sendFile sends document for pdf', async () => {
    const service = await connectedService();
    waFixtures.mockFsReadFile.mockResolvedValue(Buffer.from('fake-pdf'));
    await service.sendFile('123@s.whatsapp.net', '/tmp/report.pdf');
    expect(waFixtures.mockSendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', expect.objectContaining({ document: expect.any(Buffer), fileName: 'report.pdf' }));
  });

  it('WA-020: sendFile sends video for mp4', async () => {
    const service = await connectedService();
    waFixtures.mockFsReadFile.mockResolvedValue(Buffer.from('fake-video'));
    await service.sendFile('123@s.whatsapp.net', '/tmp/video.mp4');
    expect(waFixtures.mockSendMessage).toHaveBeenCalledWith('123@s.whatsapp.net', expect.objectContaining({ video: expect.any(Buffer), mimetype: 'video/mp4' }));
  });

  it('WA-021: sendFile rejects oversized files', async () => {
    const service = await connectedService();
    waFixtures.mockFsStat.mockResolvedValue({ size: 20 * 1024 * 1024 } as any);
    await expect(service.sendFile('123@s.whatsapp.net', '/tmp/huge.zip')).rejects.toThrow('demasiado grande');
  });
});
