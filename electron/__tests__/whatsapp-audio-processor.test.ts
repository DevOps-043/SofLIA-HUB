import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAudioProcessorMocks, mockTranscription } from './whatsapp-audio-processor.setup';
import { processAudioMessage } from '../whatsapp-audio-processor';
const mocks = getAudioProcessorMocks();
beforeEach(() => { vi.clearAllMocks(); mockTranscription(); });
describe('Audio de mensajería con OpenAI', () => {
  it.each(['ogg', 'mp3', 'wav', 'mp4', 'webm', 'flac', 'm4a'])('conserva el contenedor %s y bytes del audio', async format => {
    expect(await processAudioMessage(Buffer.from('audio-ficticio'), `audio/${format}; codecs=opus`)).toBe('Crea un evento para manana');
    const body = mocks.create.mock.calls[0][0];
    expect(body.model).toBe('gpt-transcribe');
    expect(body.file.name).toBe(`grabacion.${format}`);
    expect(Buffer.from(await body.file.arrayBuffer()).toString()).toBe('audio-ficticio');
  });
  it('audio silencioso conserva respuesta vacía', async () => {
    mockTranscription(''); expect(await processAudioMessage(Buffer.from('silencio'))).toBe('');
  });
  it('un fallo del proveedor conserva resultado vacío sin registrar contenido privado', async () => {
    mocks.create.mockRejectedValue(new Error('Detalle privado'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try { expect(await processAudioMessage(Buffer.from('audio'))).toBe(''); expect(JSON.stringify(warn.mock.calls)).not.toContain('Detalle privado'); }
    finally { warn.mockRestore(); }
  });
});
