import { useEffect, useRef } from 'react';

export interface AudioFeatureRefs {
  /** Energía de la voz 0..1 (RMS con ataque rápido y caída suave). */
  level: React.MutableRefObject<number>;
  /** Tono 0..1 (centroide espectral logarítmico y suavizado). */
  tone: React.MutableRefObject<number>;
  /** 8 bandas de frecuencia 0..1 (tipo ecualizador LED). */
  bands: React.MutableRefObject<Float32Array>;
}

export type AudioFeatureSource =
  | { kind: 'mic' }
  | { kind: 'node'; context: AudioContext; node: AudioNode }
  | null;

const FFT_SIZE = 2048;
const NUM_BANDS = 8;
const LEVEL_ATTACK = 0.46;
const LEVEL_RELEASE = 0.09;
const BAND_ATTACK = 0.38;
const BAND_RELEASE = 0.11;
const TONE_SMOOTHING = 0.14;
const MIN_NOISE_FLOOR = 0.003;
const MAX_NOISE_FLOOR = 0.03;
const INITIAL_PEAK_ENVELOPE = 0.08;
const INITIAL_SPECTRAL_PEAK = 0.28;

// Sub-bass, Bass, Low-mid, Mid, Upper-mid, Presence, Brilliance, Air.
const BAND_EDGES_HZ = [20, 60, 250, 500, 1000, 2000, 4000, 8000, 20000] as const;

interface BandBinRange {
  start: number;
  end: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smooth(current: number, target: number, attack: number, release: number): number {
  const amount = target > current ? attack : release;
  const next = current + (target - current) * amount;
  return Math.abs(next) < 0.0005 ? 0 : next;
}

function createBandRanges(sampleRate: number, binCount: number): BandBinRange[] {
  const hzPerBin = sampleRate / FFT_SIZE;
  const nyquist = sampleRate / 2;

  return BAND_EDGES_HZ.slice(0, NUM_BANDS).map((lowHz, index) => {
    const highHz = Math.min(BAND_EDGES_HZ[index + 1], nyquist);
    const start = clamp(Math.floor(lowHz / hzPerBin), 1, binCount - 1);
    const end = clamp(Math.ceil(highHz / hzPerBin), start + 1, binCount);
    return { start, end };
  });
}

/**
 * Analiza el micrófono o la salida TTS con un único AnalyserNode nativo.
 * Las métricas viven en refs para que React Three Fiber pueda leerlas en cada
 * frame sin provocar renders adicionales.
 */
export function useAudioFeatures(source: AudioFeatureSource): AudioFeatureRefs {
  const level = useRef(0);
  const tone = useRef(0.4);
  const bands = useRef(new Float32Array(NUM_BANDS));

  useEffect(() => {
    if (!source) {
      level.current = 0;
      tone.current = 0.4;
      bands.current.fill(0);
      return undefined;
    }

    let analyserNode: AnalyserNode | null = null;
    let sourceNode: AudioNode | null = null;
    let ownedContext: AudioContext | null = null;
    let micStream: MediaStream | null = null;
    let frequencyData: Uint8Array<ArrayBuffer> | null = null;
    let timeDomainData: Uint8Array<ArrayBuffer> | null = null;
    let bandRanges: BandBinRange[] = [];
    let cancelled = false;
    let rafId: number | null = null;
    let noiseFloor = source.kind === 'mic' ? 0.008 : MIN_NOISE_FLOOR;
    let peakEnvelope = INITIAL_PEAK_ENVELOPE;
    let spectralPeak = INITIAL_SPECTRAL_PEAK;
    const bandValues = bands.current;
    const rawBandLevels = new Float32Array(NUM_BANDS);

    const releaseAudioResources = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (sourceNode && analyserNode) {
        try { sourceNode.disconnect(analyserNode); } catch { /* ya desconectado */ }
      }
      try { analyserNode?.disconnect(); } catch { /* sin salidas conectadas */ }
      micStream?.getTracks().forEach((track) => track.stop());
      micStream = null;
      sourceNode = null;
      analyserNode = null;
      frequencyData = null;
      timeDomainData = null;
      bandRanges = [];
      if (ownedContext) {
        void ownedContext.close().catch(() => undefined);
        ownedContext = null;
      }
    };

    const updateFeatures = () => {
      if (cancelled || !analyserNode || !frequencyData || !timeDomainData) return;

      analyserNode.getByteTimeDomainData(timeDomainData);
      analyserNode.getByteFrequencyData(frequencyData);

      let squareSum = 0;
      for (let index = 0; index < timeDomainData.length; index += 1) {
        const sample = (timeDomainData[index] - 128) / 128;
        squareSum += sample * sample;
      }
      const rms = Math.sqrt(squareSum / timeDomainData.length);

      // En micrófono el piso se adapta lentamente solo durante señal baja.
      // En TTS se mantiene casi fijo para conservar pausas y consonantes suaves.
      if (source.kind === 'mic' && rms < noiseFloor * 2.2) {
        noiseFloor = clamp(noiseFloor + (rms - noiseFloor) * 0.015, MIN_NOISE_FLOOR, MAX_NOISE_FLOOR);
      }
      const gatedRms = rms > noiseFloor * 1.45 ? rms - noiseFloor : 0;

      // Normalización prudente: el pico decae despacio, evitando que un instante
      // silencioso amplifique ruido hasta 1.0 como haría un AGC agresivo.
      peakEnvelope = Math.max(gatedRms, peakEnvelope * 0.995);
      const levelReference = clamp(peakEnvelope, 0.055, 0.35);
      const normalizedLevel = gatedRms > 0
        ? Math.pow(clamp(gatedRms / (levelReference * 0.9), 0, 1), 0.82)
        : 0;
      level.current = smooth(level.current, normalizedLevel, LEVEL_ATTACK, LEVEL_RELEASE);

      let totalSpectralEnergy = 0;
      let weightedFrequency = 0;
      const hzPerBin = analyserNode.context.sampleRate / analyserNode.fftSize;
      for (let index = 1; index < frequencyData.length; index += 1) {
        const magnitude = frequencyData[index] / 255;
        const energy = magnitude * magnitude;
        totalSpectralEnergy += energy;
        weightedFrequency += energy * index * hzPerBin;
      }

      if (normalizedLevel > 0.015 && totalSpectralEnergy > 0.001) {
        const centroidHz = weightedFrequency / totalSpectralEnergy;
        const upperToneHz = Math.min(8000, analyserNode.context.sampleRate / 2);
        const normalizedTone = clamp(
          Math.log2(Math.max(120, centroidHz) / 120) / Math.log2(upperToneHz / 120),
          0,
          1,
        );
        tone.current += (normalizedTone - tone.current) * TONE_SMOOTHING;
      }

      let strongestBand = 0;
      for (let band = 0; band < NUM_BANDS; band += 1) {
        const range = bandRanges[band];
        let energySum = 0;
        for (let bin = range.start; bin < range.end; bin += 1) {
          const magnitude = frequencyData[bin] / 255;
          energySum += magnitude * magnitude;
        }
        const raw = Math.sqrt(energySum / Math.max(1, range.end - range.start));
        rawBandLevels[band] = raw;
        strongestBand = Math.max(strongestBand, raw);
      }

      spectralPeak = Math.max(strongestBand, spectralPeak * 0.992);
      const spectralReference = clamp(spectralPeak, 0.14, 0.85);
      const currentBands = bands.current;
      for (let band = 0; band < NUM_BANDS; band += 1) {
        const gatedBand = Math.max(0, rawBandLevels[band] - 0.025);
        const normalizedBand = normalizedLevel > 0
          ? Math.pow(clamp(gatedBand / Math.max(0.1, spectralReference - 0.025), 0, 1), 0.78)
            * (0.3 + normalizedLevel * 0.7)
          : 0;
        currentBands[band] = smooth(currentBands[band], normalizedBand, BAND_ATTACK, BAND_RELEASE);
      }

      rafId = requestAnimationFrame(updateFeatures);
    };

    const start = async () => {
      try {
        let context: AudioContext;
        if (source.kind === 'mic') {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          if (cancelled) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          micStream = stream;
          ownedContext = new AudioContext();
          context = ownedContext;
          sourceNode = context.createMediaStreamSource(stream);
        } else {
          context = source.context;
          sourceNode = source.node;
        }

        if (context.state === 'suspended') await context.resume().catch(() => undefined);
        if (cancelled || !sourceNode) {
          releaseAudioResources();
          return;
        }

        analyserNode = context.createAnalyser();
        analyserNode.fftSize = FFT_SIZE;
        analyserNode.minDecibels = -90;
        analyserNode.maxDecibels = -12;
        analyserNode.smoothingTimeConstant = 0.62;
        frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
        timeDomainData = new Uint8Array(analyserNode.fftSize);
        bandRanges = createBandRanges(context.sampleRate, analyserNode.frequencyBinCount);
        sourceNode.connect(analyserNode);
        rafId = requestAnimationFrame(updateFeatures);
      } catch (error) {
        releaseAudioResources();
        if (!cancelled) console.warn('[Orb] Análisis de audio no disponible:', error);
      }
    };

    void start();

    return () => {
      cancelled = true;
      releaseAudioResources();
      level.current = 0;
      tone.current = 0.4;
      bandValues.fill(0);
    };
  }, [source]);

  return { level, tone, bands };
}
