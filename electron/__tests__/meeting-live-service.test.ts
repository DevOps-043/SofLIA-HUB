import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingLiveService } from '../meeting-live/meeting-live-service';
import {
  buildMeetingTranscript,
  formatSpeakerLabel,
  formatTimestamp,
  isMeaningfulOcrChange,
} from '../meeting-live/transcript-builder';
import { matchMeetingWindow, MeetingDetectorService } from '../meeting-live/meeting-detector';
import { extractCandidateNames, ParticipantNameCollector } from '../meeting-live/participant-names';
import type {
  MeetingLiveSegment,
  MeetingTranscriptionPort,
} from '../meeting-live/types';

type SegmentListener = (segment: MeetingLiveSegment & { sessionId: string }) => void;

function createFakePort() {
  const segmentListeners = new Set<SegmentListener>();
  const errorListeners = new Set<(error: { sessionId: string; message: string }) => void>();
  const pushed: Array<{ source: string; audioB64: string }> = [];
  let startedSessionId = '';

  const port: MeetingTranscriptionPort = {
    start: vi.fn(async (params) => { startedSessionId = params.sessionId; }),
    pushAudio: vi.fn((source, audioB64) => { pushed.push({ source, audioB64 }); return true; }),
    stop: vi.fn(async () => pushed.length),
    onSegment: (listener) => { segmentListeners.add(listener); return () => segmentListeners.delete(listener); },
    onError: (listener) => { errorListeners.add(listener); return () => errorListeners.delete(listener); },
  };
  return {
    port,
    pushed,
    getSessionId: () => startedSessionId,
    emitSegment: (segment: MeetingLiveSegment & { sessionId: string }) =>
      segmentListeners.forEach((listener) => listener(segment)),
    emitError: (error: { sessionId: string; message: string }) =>
      errorListeners.forEach((listener) => listener(error)),
    listenersCount: () => segmentListeners.size + errorListeners.size,
  };
}

function createService(fake: ReturnType<typeof createFakePort>, overrides: Partial<{
  captureScreenshot: (sessionId: string, sequence: number) => Promise<{ filePath: string; pngBase64: string } | null>;
  extractText: (pngBase64: string) => Promise<string>;
}> = {}) {
  return new MeetingLiveService({
    transcription: fake.port,
    captureScreenshot: overrides.captureScreenshot
      ?? vi.fn(async () => ({ filePath: 'C:/tmp/captura.png', pngBase64: 'cGllbA==' })),
    extractText: overrides.extractText,
    whisperModelsDir: 'C:/tmp/whisper',
  });
}

describe('transcript-builder', () => {
  it('TB-001: formatTimestamp produce mm:ss', () => {
    expect(formatTimestamp(0)).toBe('00:00');
    expect(formatTimestamp(65_000)).toBe('01:05');
    expect(formatTimestamp(3_599_000)).toBe('59:59');
  });

  it('TB-002: el transcript ordena segmentos, etiqueta hablantes y anexa OCR', () => {
    const transcript = buildMeetingTranscript({
      title: 'Comite semanal',
      startedAt: '2026-07-16T15:00:00.000Z',
      endedAt: '2026-07-16T15:30:00.000Z',
      segments: [
        { source: 'system', speaker: 'participante-1', text: 'Revisemos el presupuesto.', t0Ms: 10_000, t1Ms: 15_000 },
        { source: 'mic', speaker: 'usuario', text: 'De acuerdo, yo presento.', t0Ms: 4_000, t1Ms: 8_000 },
        { source: 'system', speaker: 'participante-2', text: 'Yo comparto pantalla.', t0Ms: 20_000, t1Ms: 24_000 },
      ],
      screenshots: [
        { filePath: 'x.png', ocrText: 'Slide: Presupuesto Q3 2026', namesVisible: [], capturedAtMs: 12_000 },
        { filePath: 'y.png', ocrText: '', namesVisible: [], capturedAtMs: 60_000 },
      ],
    });
    const micIndex = transcript.indexOf('[00:04] Usuario: De acuerdo, yo presento.');
    const systemIndex = transcript.indexOf('[00:10] Participante 1: Revisemos el presupuesto.');
    expect(micIndex).toBeGreaterThan(-1);
    expect(systemIndex).toBeGreaterThan(micIndex);
    expect(transcript).toContain('[00:20] Participante 2: Yo comparto pantalla.');
    // Instrucciones de atribucion para que la IA mapee etiquetas a nombres reales.
    expect(transcript).toContain('Participante 1..2');
    expect(transcript).toContain('usa los nombres reales');
    expect(transcript).toContain('CONTENIDO VISIBLE EN PANTALLA');
    expect(transcript).toContain('[00:12] Slide: Presupuesto Q3 2026');
    // La captura sin OCR no genera linea vacia.
    expect(transcript).not.toContain('[01:00]');
  });

  it('TB-004: formatSpeakerLabel cubre usuario, participante-N y degradacion', () => {
    expect(formatSpeakerLabel({ source: 'mic', speaker: 'usuario', text: '', t0Ms: 0, t1Ms: 0 })).toBe('Usuario');
    expect(formatSpeakerLabel({ source: 'system', speaker: 'participante-3', text: '', t0Ms: 0, t1Ms: 0 })).toBe('Participante 3');
    expect(formatSpeakerLabel({ source: 'system', speaker: 'participantes', text: '', t0Ms: 0, t1Ms: 0 })).toBe('Participantes');
  });

  it('TB-005: participantes detectados y linea de tiempo de nombres entran al transcript', () => {
    const transcript = buildMeetingTranscript({
      title: 'Kickoff',
      startedAt: '2026-07-16T15:00:00.000Z',
      endedAt: '2026-07-16T15:30:00.000Z',
      segments: [
        { source: 'system', speaker: 'participante-1', text: 'Hola a todos.', t0Ms: 5_000, t1Ms: 9_000 },
      ],
      screenshots: [
        { filePath: 'a.png', ocrText: '', namesVisible: ['Ana García', 'Juan Pérez'], capturedAtMs: 10_000 },
        // Mismos nombres: no repite la linea de tiempo.
        { filePath: 'b.png', ocrText: '', namesVisible: ['Juan Pérez', 'Ana García'], capturedAtMs: 85_000 },
        { filePath: 'c.png', ocrText: '', namesVisible: ['Ana García'], capturedAtMs: 160_000 },
      ],
      participantsDetected: ['Ana García', 'Juan Pérez'],
    });
    expect(transcript).toContain('PARTICIPANTES DETECTADOS EN PANTALLA (OCR de los tiles de la reunion): Ana García, Juan Pérez.');
    expect(transcript).toContain('[00:10] EN PANTALLA: Ana García, Juan Pérez');
    expect(transcript).toContain('[02:40] EN PANTALLA: Ana García');
    expect(transcript).not.toContain('[01:25]'); // conjunto sin cambios no se repite
  });

  it('TB-003: isMeaningfulOcrChange descarta slides repetidas y textos triviales', () => {
    const slide = 'Presupuesto Q3 2026 - Ingresos proyectados por region y equipo de ventas';
    expect(isMeaningfulOcrChange('', slide)).toBe(true);
    expect(isMeaningfulOcrChange(slide, `${slide} `)).toBe(false);
    expect(isMeaningfulOcrChange(slide, 'ok')).toBe(false);
    expect(isMeaningfulOcrChange(slide, 'Minuta anterior: acuerdos, responsables y fechas compromiso del sprint')).toBe(true);
  });
});

describe('participant-names', () => {
  it('PN-001: extrae nombres de tiles y descarta UI, digitos y frases largas', () => {
    const ocr = [
      'Ana García',
      'Juan Pérez López',
      'Silenciar micrófono',
      'Compartir pantalla',
      'Sala 3 - Piso 2',
      'Presupuesto aprobado por el comité directivo en la sesión anterior',
      'maría lópez', // sin mayuscula inicial: el OCR de un tile real la trae
      'Google Meet',
    ].join('\n');
    expect(extractCandidateNames(ocr)).toEqual(['Ana García', 'Juan Pérez López']);
  });

  it('PN-002: el colector confirma solo nombres vistos en 2+ capturas', () => {
    const collector = new ParticipantNameCollector();
    collector.addFromOcr('Ana García\nJuan Pérez\nRuido Ocr', 10_000);
    collector.addFromOcr('Ana García\nJuan Pérez', 85_000);
    collector.addFromOcr('Ana García', 160_000);
    expect(collector.getConfirmedNames()).toEqual(['Ana García', 'Juan Pérez']);
  });

  it('PN-003: el mismo nombre con acentos distintos cuenta como uno', () => {
    const collector = new ParticipantNameCollector();
    collector.addFromOcr('Ana García', 1_000);
    collector.addFromOcr('Ana Garcia', 2_000); // el OCR pierde el acento a veces
    expect(collector.getConfirmedNames()).toEqual(['Ana García']);
  });
});

describe('meeting-detector', () => {
  it('MD-001: matchMeetingWindow reconoce reuniones activas y descarta apps sin llamada', () => {
    expect(matchMeetingWindow('zoom.exe', 'Zoom Meeting')?.platform).toBe('zoom');
    expect(matchMeetingWindow('Zoom', 'Reunión de Zoom')?.platform).toBe('zoom');
    expect(matchMeetingWindow('ms-teams.exe', 'Reunión | Microsoft Teams')?.platform).toBe('teams');
    expect(matchMeetingWindow('chrome.exe', 'Meet – abc-defg-hij - Google Chrome')?.platform).toBe('meet');
    // Chrome actual titula la pestaña con dos puntos: "Meet: yab-noco-myv".
    expect(matchMeetingWindow('chrome.exe', 'Meet: yab-noco-myv - Google Chrome')?.platform).toBe('meet');
    expect(matchMeetingWindow('firefox.exe', 'Google Meet — Mozilla Firefox')?.platform).toBe('meet');
    // Apps abiertas SIN reunion en curso no deben disparar el prompt.
    expect(matchMeetingWindow('zoom.exe', 'Zoom Workplace')).toBeNull();
    expect(matchMeetingWindow('ms-teams.exe', 'Actividad | Microsoft Teams')).toBeNull();
    expect(matchMeetingWindow('chrome.exe', 'Gmail - Google Chrome')).toBeNull();
    expect(matchMeetingWindow('Code.exe', 'meeting-detector.ts - VSCode')).toBeNull();
  });

  it('MD-002: emite una vez por plataforma con cooldown y respeta la captura activa', async () => {
    vi.useFakeTimers();
    try {
      let activeTitle = 'Zoom Meeting';
      let capturing = false;
      const detected: unknown[] = [];
      const detector = new MeetingDetectorService({
        getActiveWindow: async () => ({ title: activeTitle, process: 'zoom.exe' }),
        isCaptureActive: () => capturing,
        pollIntervalMs: 1_000,
        cooldownMs: 60_000,
      });
      detector.on('meeting-detected', (payload) => detected.push(payload));
      detector.start();

      await vi.advanceTimersByTimeAsync(3_000);
      expect(detected).toHaveLength(1); // cooldown: no repite en cada poll

      capturing = true;
      activeTitle = 'Reunión de Zoom';
      detector.resetCooldown();
      await vi.advanceTimersByTimeAsync(3_000);
      expect(detected).toHaveLength(1); // en captura no se vuelve a proponer

      capturing = false;
      detector.resetCooldown();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(detected).toHaveLength(2); // tras terminar, puede proponer de nuevo

      detector.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('MD-003: la deteccion queda como estado consultable hasta atenderse o caducar', async () => {
    vi.useFakeTimers();
    try {
      let nowMs = 1_000_000;
      const detector = new MeetingDetectorService({
        getActiveWindow: async () => ({ title: 'Meet: yab-noco-myv - Google Chrome', process: 'chrome' }),
        isCaptureActive: () => false,
        pollIntervalMs: 1_000,
        cooldownMs: 60_000,
        now: () => nowMs,
      });
      detector.start();
      expect(detector.getPendingDetection()).toBeNull();

      await vi.advanceTimersByTimeAsync(1_000);
      // La orbe que se abre DESPUES del evento recupera la deteccion como estado.
      expect(detector.getPendingDetection()?.platform).toBe('meet');

      detector.clearPendingDetection();
      expect(detector.getPendingDetection()).toBeNull();

      // Nueva deteccion que nadie atiende: caduca a los 10 minutos.
      detector.resetCooldown();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(detector.getPendingDetection()?.platform).toBe('meet');
      nowMs += 11 * 60_000;
      expect(detector.getPendingDetection()).toBeNull();

      detector.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('MeetingLiveService', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('ML-001: ciclo start -> segmentos -> stop arma el transcript final', async () => {
    const fake = createFakePort();
    const service = createService(fake);

    await service.start({ title: 'Kickoff', screenshotIntervalMs: 0 });
    expect(service.getStatus().status).toBe('grabando');

    fake.emitSegment({ sessionId: fake.getSessionId(), source: 'mic', speaker: 'usuario', text: 'hola a todos', t0Ms: 0, t1Ms: 4000 });
    fake.emitSegment({ sessionId: fake.getSessionId(), source: 'system', speaker: 'participante-1', text: 'hola, empecemos', t0Ms: 1000, t1Ms: 5000 });
    expect(service.getStatus().segmentsCount).toBe(2);

    const finished = await service.stop();
    expect(finished.transcript).toContain('Usuario: hola a todos');
    expect(finished.transcript).toContain('Participante 1: hola, empecemos');
    expect(service.getStatus().status).toBe('idle');
    expect(service.getLastFinishedSession()?.sessionId).toBe(finished.sessionId);
    // Los listeners del puerto quedaron liberados.
    expect(fake.listenersCount()).toBe(0);
  });

  it('ML-002: segmentos de una sesion vieja se ignoran', async () => {
    const fake = createFakePort();
    const service = createService(fake);
    await service.start({ screenshotIntervalMs: 0 });
    fake.emitSegment({ sessionId: 'sesion-anterior', source: 'mic', speaker: 'usuario', text: 'fantasma', t0Ms: 0, t1Ms: 1 });
    expect(service.getStatus().segmentsCount).toBe(0);
    await service.stop();
  });

  it('ML-003: pushAudio valida estado, fuente y tamaño del chunk', async () => {
    const fake = createFakePort();
    const service = createService(fake);

    expect(service.pushAudio('mic', 'AAAA')).toBe(false); // sin sesion activa

    await service.start({ screenshotIntervalMs: 0 });
    expect(service.pushAudio('mic', 'AAAA')).toBe(true);
    expect(service.pushAudio('otra' as never, 'AAAA')).toBe(false);
    expect(service.pushAudio('mic', 'x'.repeat(1_000_001))).toBe(false);
    expect(fake.pushed).toHaveLength(1);
    await service.stop();
  });

  it('ML-004: no permite dos sesiones simultaneas ni stop sin sesion', async () => {
    const fake = createFakePort();
    const service = createService(fake);
    await service.start({ screenshotIntervalMs: 0 });
    await expect(service.start()).rejects.toThrow(/en curso/);
    await service.stop();
    await expect(service.stop()).rejects.toThrow(/No hay una sesion/);
  });

  it('ML-005: capturas periodicas con OCR deduplicado y cosecha de nombres', async () => {
    const fake = createFakePort();
    const ocrResults = [
      'Ana García\nSlide inicial con la agenda completa de la reunion semanal',
      'Ana García\nSlide inicial con la agenda completa de la reunion semanal',
      'Ana García\nSlide dos: resultados financieros y proyecciones del siguiente trimestre',
    ];
    let calls = 0;
    const service = createService(fake, {
      extractText: vi.fn(async () => ocrResults[Math.min(calls++, ocrResults.length - 1)]),
    });

    await service.start({ screenshotIntervalMs: 15_000 });
    for (let i = 0; i < 3; i += 1) {
      await vi.advanceTimersByTimeAsync(15_000);
    }
    const finished = await service.stop();

    expect(finished.screenshots).toHaveLength(3);
    const withText = finished.screenshots.filter((shot) => shot.ocrText.length > 0);
    // La slide repetida no duplica texto en el contexto...
    expect(withText).toHaveLength(2);
    // ...pero los nombres se cosechan de TODAS las capturas (incluso deduplicadas).
    expect(finished.screenshots[1].namesVisible).toContain('Ana García');
    expect(finished.participantsDetected).toEqual(['Ana García']);
    expect(finished.transcript).toContain('PARTICIPANTES DETECTADOS EN PANTALLA');
  });

  it('ML-006: si el drenado del sidecar falla, stop igual entrega transcript y estado idle', async () => {
    const fake = createFakePort();
    (fake.port.stop as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('sidecar muerto'));
    const service = createService(fake);
    await service.start({ screenshotIntervalMs: 0 });
    fake.emitSegment({ sessionId: fake.getSessionId(), source: 'mic', speaker: 'usuario', text: 'parcial', t0Ms: 0, t1Ms: 1000 });

    const finished = await service.stop();
    expect(finished.transcript).toContain('parcial');
    expect(service.getStatus().status).toBe('idle');
    expect(service.getStatus().lastError).toContain('sidecar muerto');
  });
});
