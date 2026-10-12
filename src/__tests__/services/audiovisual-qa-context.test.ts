import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeSkillWorkspaceTool } from '../../services/gemini-chat/skill-workspace-tools';
import fixture from '../../../test/fixtures/audiovisual-cinematic.json';
import { filmV2Schema } from '../../shared/audiovisual/film-v2-schema';
import { scoreEvents } from '../../shared/audiovisual/audio-score';
import { prepareToolResult } from '../../services/gemini-chat/tool-result-payload';
vi.mock('../../services/image-generation', () => ({ generateImage: vi.fn() }));
const active = { id: 'sistema:audiovisual', tools: [], workspaceId: 'ws-qa' };
describe('QA audiovisual dentro del contexto del modelo', () => {
  afterEach(() => { delete (window as unknown as { skillWorkspace?: unknown }).skillWorkspace; });
  it('conserva mediciones, hashes y todos los eventos de un QA grande', async () => {
    const report = { ok: true, frames: 1800, duracion: 30, timestamps: true, decodificacion: true, loudness: { lufs: -14.09, pico: -2.39, rangoDinamico: 4 }, filmHash: 'a'.repeat(64), videoHash: 'b'.repeat(64), eventosAudio: Array.from({ length: 358 }, (_, i) => ({ frame: i * 5, tipo: 'confirmacion' })) };
    const content = JSON.stringify(report, null, 2);
    const original = JSON.stringify({ success: true, content });
    // Reproduce el caso observado: el sangrado hace omitir el campo completo.
    expect(original.length).toBeGreaterThan(24_000);
    expect(JSON.parse(prepareToolResult(original).text).content).toContain('omitido');
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = { readFile: vi.fn().mockResolvedValue({ success: true, content }) };
    const raw = await executeSkillWorkspaceTool('workspace_read_file', { path: 'qa/informe.json' }, active);
    const payload = prepareToolResult(raw);
    expect(payload.text.length).toBeLessThan(24_000);
    const received = JSON.parse(JSON.parse(payload.text).content);
    expect(received.eventosAudio.columnas).toEqual(['frame', 'tipo']);
    received.eventosAudio = received.eventosAudio.filas.map(([frame, tipo]: [number, string]) => ({ frame, tipo }));
    expect(received).toEqual(report);
  });
  it('transporta el extremo válido de 60 segundos y 140 BPM sin perder eventos', async () => {
    const film = structuredClone(fixture);
    film.fotogramas = 3600; film.duracionObjetivo = 60; film.sonido.tempo = 140;
    film.escenas.forEach(scene => { scene.inicio *= 2; scene.fin *= 2; scene.transicion = Math.min(90, scene.transicion * 2); scene.acciones.forEach(action => { action.en *= 2; }); });
    const validated = filmV2Schema.parse(film), eventosAudio = scoreEvents(validated).map(event => ({ frame: Math.round(event.at * validated.fps), tipo: event.voice }));
    expect(eventosAudio.length).toBeGreaterThan(0);
    const report = { ok: true, duracion: 60, frames: 3600, eventosAudio, timestamps: true, filmHash: 'a'.repeat(64), loudness: { lufs: -14, pico: -2 } };
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = { readFile: vi.fn().mockResolvedValue({ success: true, content: JSON.stringify(report, null, 2) }) };
    const payload = prepareToolResult(await executeSkillWorkspaceTool('workspace_read_file', { path: 'qa/informe.json' }, active));
    expect(payload.text.length).toBeLessThan(24_000);
    const received = JSON.parse(JSON.parse(payload.text).content);
    received.eventosAudio = received.eventosAudio.filas.map(([frame, tipo]: [number, string]) => ({ frame, tipo }));
    expect(received).toEqual(report);
  });
  it('no modifica documentos del usuario ni convierte un informe malformado en éxito', async () => {
    const content = 'Texto del usuario\n  conserva el formato.';
    const readFile = vi.fn().mockResolvedValue({ success: true, content });
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = { readFile };
    for (const path of ['guion.md', 'qa/informe.json']) {
      expect(JSON.parse(await executeSkillWorkspaceTool('workspace_read_file', { path }, active))).toEqual({ success: true, content });
    }
    readFile.mockResolvedValue({ success: false, error: 'No existe el informe.' });
    expect(JSON.parse(await executeSkillWorkspaceTool('workspace_read_file', { path: 'qa/informe.json' }, active))).toEqual({ success: false, error: 'No existe el informe.' });
  });
});
