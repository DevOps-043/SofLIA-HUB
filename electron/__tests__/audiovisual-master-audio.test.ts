import { beforeEach, describe, expect, it, vi } from 'vitest';
import { masterAudio } from '../audiovisual/master-audio';
import { mediaProcess } from '../audiovisual/process';
vi.mock('../audiovisual/process', () => ({ mediaProcess: vi.fn() }));
const processMock = vi.mocked(mediaProcess);
const measurement = (i: string, tp: string, lra = '3.7') => JSON.stringify({ input_i: i, input_tp: tp, input_lra: lra });
describe('masterización con dinámica conservada', () => {
  beforeEach(() => vi.resetAllMocks());
  it('corrige el pico del AAC y vuelve a medir antes de aceptarlo', async () => {
    processMock.mockResolvedValueOnce(measurement('-21.82', '-7.76'))
      .mockResolvedValueOnce('').mockResolvedValueOnce(measurement('-15.2', '-.4'))
      .mockResolvedValueOnce('').mockResolvedValueOnce(measurement('-14.06', '-2.29'));
    const result = await masterAudio('ffmpeg', 'pcm.wav', 'score.m4a', false, new AbortController().signal);
    expect(result).toEqual({ lufs: -14.06, pico: -2.29, rangoDinamico: 3.7 });
    const filters = processMock.mock.calls.filter(call => call[1].includes('-y')).map(call => call[1][call[1].indexOf('-af') + 1]);
    expect(filters[0]).toContain('volume=7.82dB,alimiter=');
    expect(filters[1]).not.toBe(filters[0]);
    expect(filters.every(filter => !filter.includes('loudnorm'))).toBe(true);
  });
  it('rechaza audio no medible antes de codificar y rechaza un master fuera del perfil', async () => {
    processMock.mockResolvedValueOnce(measurement('-inf', '-inf'));
    await expect(masterAudio('ffmpeg', 'pcm.wav', 'score.m4a', false, new AbortController().signal)).rejects.toThrow('audio medible');
    expect(processMock).toHaveBeenCalledTimes(1);
    processMock.mockReset();
    processMock.mockResolvedValueOnce(measurement('-20', '-8'));
    for (let i = 0; i < 3; i++) processMock.mockResolvedValueOnce('').mockResolvedValueOnce(measurement('-17', '-.5'));
    await expect(masterAudio('ffmpeg', 'pcm.wav', 'score.m4a', false, new AbortController().signal)).rejects.toThrow('no cumple');
    expect(processMock).toHaveBeenCalledTimes(7);
  });
});
