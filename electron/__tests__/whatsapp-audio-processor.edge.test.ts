import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAudioProcessorMocks, mockTranscription } from './whatsapp-audio-processor.setup';
import { processAudioMessage } from '../whatsapp-audio-processor';
const mocks = getAudioProcessorMocks();
beforeEach(() => { vi.clearAllMocks(); mockTranscription(); });
describe('Límites de audio de mensajería', () => {
  it('el buffer vacío no resuelve credenciales ni inicia inferencia', async () => {
    expect(await processAudioMessage(Buffer.alloc(0))).toBe(''); expect(mocks.client).not.toHaveBeenCalled();
  });
  it('una sesión revocada no inicia inferencia', async () => {
    mocks.client.mockRejectedValue(new Error('Sesión revocada'));
    expect(await processAudioMessage(Buffer.from('audio'))).toBe(''); expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rechaza tamaño excesivo y formato desconocido sin enviar bytes', async () => {
    expect(await processAudioMessage(Buffer.from('audio'), 'audio/desconocido')).toBe('');
    expect(await processAudioMessage(Buffer.alloc(25_000_001))).toBe(''); expect(mocks.create).not.toHaveBeenCalled();
  });
});
