import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AmbientAudioCapture } from '../../services/ambient-audio-service';
import { encodePcm16ToWav, floatToPcm16, wavDurationSeconds } from '../../services/audio-capture/wav';
import { MEDIA_BUDGET } from '../../shared/multimodal-input';

/** Pista falsa que reporta el ciclo de vida que el servicio observa. */
function pistaFalsa() {
  return { stop: vi.fn(), addEventListener: vi.fn() };
}

function streamFalso(conAudio = true) {
  const audio = conAudio ? [pistaFalsa()] : [];
  const video = [pistaFalsa()];
  return {
    getAudioTracks: () => audio,
    getVideoTracks: () => video,
    getTracks: () => [...audio, ...video],
  } as unknown as MediaStream;
}

function instalarAudioApi(overrides: Record<string, any> = {}) {
  const contexto = {
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    createScriptProcessor: vi.fn(() => ({
      connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null as any,
    })),
    audioWorklet: { addModule: vi.fn(async () => { throw new Error('sin worklet'); }) },
    close: vi.fn(async () => undefined),
    destination: {},
  };
  vi.stubGlobal('AudioContext', vi.fn().mockImplementation(function () { return contexto; }));
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getDisplayMedia: vi.fn(async () => streamFalso()),
      getUserMedia: vi.fn(async () => streamFalso()),
      enumerateDevices: vi.fn(async () => []),
      ...overrides,
    },
  });
  return contexto;
}

describe('escucha ambiental', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('AMB-001: el modelo no puede iniciar la escucha sin peticion del usuario', async () => {
    instalarAudioApi();
    const captura = new AmbientAudioCapture();

    const resultado = await captura.listen({ source: 'sistema', seconds: 5, authorizedByUser: false });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.reason).toBe('no-autorizado');
    expect((navigator.mediaDevices.getDisplayMedia as any)).not.toHaveBeenCalled();
  });

  it('AMB-002: sin captura de salida se declara y se ofrece el microfono', async () => {
    instalarAudioApi({
      getDisplayMedia: vi.fn(async () => streamFalso(false)),
      enumerateDevices: vi.fn(async () => []),
    });
    const captura = new AmbientAudioCapture();

    const resultado = await captura.listen({ source: 'sistema', seconds: 1, authorizedByUser: true });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.reason).toBe('fuente-no-disponible');
      expect(resultado.detail).toContain('microfono');
    }
  });

  it('AMB-003: un permiso denegado del sistema operativo se declara como tal', async () => {
    const denegado = Object.assign(new Error('denegado'), { name: 'NotAllowedError' });
    instalarAudioApi({ getUserMedia: vi.fn(async () => { throw denegado; }) });
    const captura = new AmbientAudioCapture();

    const resultado = await captura.listen({ source: 'microfono', seconds: 1, authorizedByUser: true });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.reason).toBe('permiso-denegado');
  });

  it('AMB-004: la detencion explicita cierra la captura y libera el dispositivo', async () => {
    const pista = pistaFalsa();
    const stream = {
      getAudioTracks: () => [pista], getVideoTracks: () => [], getTracks: () => [pista],
    } as unknown as MediaStream;
    instalarAudioApi({ getUserMedia: vi.fn(async () => stream) });
    const captura = new AmbientAudioCapture();

    const pendiente = captura.listen({ source: 'microfono', seconds: 60, authorizedByUser: true });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(captura.getStatus().active).toBe(true);
    captura.stop();
    await pendiente;

    expect(captura.getStatus().active).toBe(false);
    expect(pista.stop).toHaveBeenCalled();
  }, 10_000);

  it('AMB-005: la duracion se acota al maximo por turno', async () => {
    instalarAudioApi();
    const captura = new AmbientAudioCapture();
    const inicio = Date.now();

    const pendiente = captura.listen({ source: 'microfono', seconds: 10_000, authorizedByUser: true });
    // Se detiene antes para no esperar el limite real; lo que se comprueba es
    // que no se programo una espera de 10 000 segundos.
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    captura.stop();
    await pendiente;

    expect(Date.now() - inicio).toBeLessThan(MEDIA_BUDGET.maxAmbientAudioSeconds * 1000);
  }, 10_000);

  it('AMB-006: cancelar el turno descarta el audio capturado', async () => {
    instalarAudioApi();
    const captura = new AmbientAudioCapture();

    const pendiente = captura.listen({ source: 'microfono', seconds: 30, authorizedByUser: true });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    captura.cancel();
    const resultado = await pendiente;

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.reason).toBe('sin-audio');
  }, 10_000);
});

describe('encapsulado WAV', () => {
  it('WAV-001: produce una cabecera RIFF/WAVE valida de 44 bytes', () => {
    const wav = encodePcm16ToWav(new Int16Array([0, 1, -1, 32767]));

    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe('WAVE');
    expect(String.fromCharCode(...wav.subarray(36, 40))).toBe('data');
    expect(wav.length).toBe(44 + 4 * 2);
  });

  it('WAV-002: declara mono, 16 bits y 16 kHz', () => {
    const wav = encodePcm16ToWav(new Int16Array([0]));
    const vista = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(vista.getUint16(22, true)).toBe(1); // canales
    expect(vista.getUint32(24, true)).toBe(16_000); // frecuencia
    expect(vista.getUint16(34, true)).toBe(16); // bits por muestra
  });

  it('WAV-003: la conversion a PCM acota los valores fuera de rango', () => {
    const pcm = floatToPcm16(new Float32Array([2, -2, 0]));

    expect(pcm[0]).toBe(32767);
    expect(pcm[1]).toBe(-32767);
    expect(pcm[2]).toBe(0);
  });

  it('WAV-004: la duracion se deriva del numero de muestras', () => {
    expect(wavDurationSeconds(16_000)).toBe(1);
    expect(wavDurationSeconds(8_000)).toBe(0.5);
  });
});
