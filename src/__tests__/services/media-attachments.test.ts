import { describe, expect, it } from 'vitest';
import {
  classifyMedia,
  evaluateCandidate,
  evaluateCombinedDuration,
  isReadyToSend,
  resolveTransport,
  type MediaAttachment,
} from '../../services/media-attachments';
import { MEDIA_BUDGET } from '../../shared/multimodal-input';

const LISTO: MediaAttachment = {
  id: 'a', name: 'a.mp4', mimeType: 'video/mp4', sizeBytes: 10, state: 'listo',
};

describe('adjuntos de medio del compositor', () => {
  it('ADJ-001: un video admitido se acepta', () => {
    const veredicto = evaluateCandidate({ name: 'demo.mp4', mimeType: 'video/mp4', sizeBytes: 5_000_000 }, []);

    expect(veredicto.accepted).toBe(true);
  });

  it('ADJ-002: un audio admitido se acepta', () => {
    const veredicto = evaluateCandidate({ name: 'nota.mp3', mimeType: 'audio/mpeg', sizeBytes: 2_000_000 }, []);

    expect(veredicto.accepted).toBe(true);
  });

  it('ADJ-003: un formato no admitido se rechaza indicando los admitidos', () => {
    const veredicto = evaluateCandidate({ name: 'a.zip', mimeType: 'application/zip', sizeBytes: 10 }, []);

    expect(veredicto.accepted).toBe(false);
    if (!veredicto.accepted) {
      expect(veredicto.rejection.reason).toBe('formato-no-admitido');
      expect(veredicto.rejection.detail).toContain('application/zip');
      expect(veredicto.rejection.detail).toContain('MP4');
    }
  });

  it('ADJ-004: un archivo sobre el limite del proveedor se rechaza con su tamaño', () => {
    const veredicto = evaluateCandidate(
      { name: 'enorme.mp4', mimeType: 'video/mp4', sizeBytes: 3 * 1024 ** 3 },
      [],
    );

    expect(veredicto.accepted).toBe(false);
    if (!veredicto.accepted) {
      expect(veredicto.rejection.reason).toBe('excede-limite-proveedor');
      expect(veredicto.rejection.detail).toContain('3.0 GB');
    }
  });

  it('ADJ-005: el limite de adjuntos por turno se aplica y se explica', () => {
    const llenos = Array.from({ length: MEDIA_BUDGET.maxMediaPerTurn }, (_, i) => ({ ...LISTO, id: `a${i}` }));
    const veredicto = evaluateCandidate({ name: 'otro.mp4', mimeType: 'video/mp4', sizeBytes: 10 }, llenos);

    expect(veredicto.accepted).toBe(false);
    if (!veredicto.accepted) expect(veredicto.rejection.reason).toBe('limite-de-adjuntos');
  });

  it('ADJ-006: un video grande se sube y uno pequeño viaja incrustado', () => {
    expect(resolveTransport('video/mp4', MEDIA_BUDGET.maxInlineBytes + 1)).toBe('upload');
    expect(resolveTransport('video/mp4', 1_000)).toBe('inline');
  });

  it('ADJ-007: una imagen siempre viaja incrustada', () => {
    expect(resolveTransport('image/png', MEDIA_BUDGET.maxInlineBytes * 4)).toBe('inline');
  });

  it('ADJ-008: la duracion combinada excedida se declara', () => {
    const largos: MediaAttachment[] = [
      { ...LISTO, id: 'a', durationSeconds: MEDIA_BUDGET.maxCombinedDurationSeconds },
      { ...LISTO, id: 'b', durationSeconds: 60 },
    ];

    expect(evaluateCombinedDuration(largos)).toMatchObject({ reason: 'duracion-total' });
    expect(evaluateCombinedDuration([LISTO])).toBeNull();
  });

  it('ADJ-009: el turno espera a que ningun adjunto siga en vuelo', () => {
    expect(isReadyToSend([LISTO])).toBe(true);
    expect(isReadyToSend([{ ...LISTO, state: 'fallido' }])).toBe(true);
    expect(isReadyToSend([{ ...LISTO, state: 'subiendo' }])).toBe(false);
    expect(isReadyToSend([{ ...LISTO, state: 'procesando' }])).toBe(false);
  });

  it('ADJ-010: la clasificacion distingue imagen, video y audio', () => {
    expect(classifyMedia('image/png')).toBe('imagen');
    expect(classifyMedia('video/webm')).toBe('video');
    expect(classifyMedia('audio/flac')).toBe('audio');
    expect(classifyMedia('application/pdf')).toBe('otro');
  });
});
