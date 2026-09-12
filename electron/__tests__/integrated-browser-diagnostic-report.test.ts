import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserWindow, dialog } from 'electron';
import { BrowserDiagnosticExporter, buildBrowserDiagnosticReport, DIAGNOSTIC_REVIEW_TTL_MS, MAX_DIAGNOSTIC_BYTES } from '../integrated-browser/diagnostic-report';

const now = Date.parse('2026-09-05T18:00:00Z');
const input = () => ({
  startedAt: now - 60_000,
  runtime: { appVersion: '0.9.8', electronVersion: '43.4.0', chromiumVersion: '150.0.7871.224', nodeVersion: '24.18.1', profileKind: 'authenticated' as const, protectionLevel: 'off' as const, managed: false, checkedAt: 'no copiar' },
  tabs: 3, liveViews: 2, detachedWindows: 1, groups: 1,
  downloadStates: ['completed', 'completed', 'interrupted'] as const,
});
const roots: string[] = [];

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-diagnostic-test-'));
  roots.push(root);
  const destination = path.join(root, 'reporte.json');
  const context = { scopeId: 'perfil-ficticio', generation: 1, changing: false, authenticated: true, parent: new BrowserWindow() as BrowserWindow | null };
  const collect = vi.fn(input);
  const exporter = new BrowserDiagnosticExporter(() => context, collect);
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: destination });
  return { root, destination, context, collect, exporter };
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  vi.mocked(dialog.showMessageBox).mockReset().mockResolvedValue({ response: 0, checkboxChecked: false });
  vi.mocked(dialog.showSaveDialog).mockReset().mockResolvedValue({ canceled: true, filePath: '' });
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

describe('instantánea de diagnóstico del navegador', () => {
  it('sólo proyecta campos cerrados y declara fuente, periodo y agregación', () => {
    const raw = { ...input(), url: 'https://secreto.test/?token=ficticio', username: 'persona', path: 'C:/privado', error: 'secreto', title: 'privado' };
    Object.assign(raw.runtime, { token: 'secreto', appVersion: 'C:/privado?token=ficticio' });
    const report = buildBrowserDiagnosticReport(raw);
    expect(report).toMatchObject({ schemaVersion: 1, scope: 'local-profile', period: { startedAt: new Date(now - 60_000).toISOString(), capturedAt: new Date(now).toISOString() }, runtime: { appVersion: null, electronVersion: '43.4.0', profileKind: 'authenticated' } });
    expect(report.metrics).toHaveLength(12);
    expect(report.metrics.find((metric) => metric.id === 'downloads.completed')).toEqual({ id: 'downloads.completed', value: 2, source: 'retained-downloads', aggregation: 'snapshot' });
    expect(report.metrics.every((metric) => metric.aggregation === 'snapshot' && metric.source)).toBe(true);
    const serialized = JSON.stringify(report);
    for (const forbidden of ['secreto', 'ficticio', 'persona', 'privado', 'no copiar', 'token', 'username', 'checkedAt']) expect(serialized).not.toContain(forbidden);
    expect(Buffer.byteLength(serialized)).toBeLessThan(MAX_DIAGNOSTIC_BYTES);
  });

  it('cero actividad genera ceros observados, no actividad inventada', () => {
    const report = buildBrowserDiagnosticReport({ ...input(), tabs: 0, liveViews: 0, detachedWindows: 0, groups: 0, downloadStates: [] });
    expect(report.metrics.every((metric) => metric.value === 0)).toBe(true);
  });

  it.each([{ tabs: 501 }, { liveViews: 9 }, { detachedWindows: 5 }, { groups: -1 }, { tabs: Number.NaN }, { tabs: 1.5 }, { startedAt: now + 1 }, { downloadStates: Array(201).fill('completed') }, { downloadStates: ['secreto'] }])('rechaza límites o estados inválidos: %j', (override) => {
    expect(() => buildBrowserDiagnosticReport({ ...input(), ...override } as Parameters<typeof buildBrowserDiagnosticReport>[0])).toThrow();
  });

  it('rechaza invitados y conteos inconsistentes', () => {
    expect(() => buildBrowserDiagnosticReport({ ...input(), runtime: { ...input().runtime, profileKind: 'guest' } })).toThrow();
    expect(() => buildBrowserDiagnosticReport({ ...input(), tabs: 0 })).toThrow();
  });
});

describe('exportación local con consentimiento nativo', () => {
  it('confirmar y elegir archivo crea un JSON completo sin devolver rutas ni reporte', async () => {
    const f = await fixture();
    vi.mocked(dialog.showMessageBox).mockImplementationOnce(async () => {
      expect(await fs.readdir(f.root)).toEqual([]);
      return { response: 0, checkboxChecked: false };
    });
    expect(await f.exporter.exportFromDialog()).toEqual({ cancelled: false, exported: true });
    const saved = JSON.parse(await fs.readFile(f.destination, 'utf8'));
    expect(saved).toEqual(buildBrowserDiagnosticReport(input()));
    expect(await fs.readdir(f.root)).toEqual(['reporte.json']);
    const args: unknown[] = vi.mocked(dialog.showMessageBox).mock.calls[0];
    expect(args[args.length - 1]).toMatchObject({ defaultId: 1, cancelId: 1 });
    expect(JSON.stringify(args[args.length - 1])).not.toContain(f.root);
  });

  it('cancelar la confirmación no abre selector ni escribe', async () => {
    const f = await fixture();
    vi.mocked(dialog.showMessageBox).mockResolvedValueOnce({ response: 1, checkboxChecked: false });
    expect(await f.exporter.exportFromDialog()).toEqual({ cancelled: true, exported: false });
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    expect(await fs.readdir(f.root)).toEqual([]);
  });

  it('cancelar el selector no escribe', async () => {
    const f = await fixture();
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });
    expect(await f.exporter.exportFromDialog()).toEqual({ cancelled: true, exported: false });
    expect(await fs.readdir(f.root)).toEqual([]);
  });

  it.each(['scope', 'generation', 'window', 'transition', 'authentication', 'destroyed', 'expiry'])('invalida la aprobación si cambia %s', async (change) => {
    const f = await fixture();
    vi.mocked(dialog.showSaveDialog).mockImplementationOnce(async () => {
      if (change === 'scope') f.context.scopeId = 'otro';
      if (change === 'generation') f.context.generation++;
      if (change === 'window') f.context.parent = new BrowserWindow();
      if (change === 'transition') f.context.changing = true;
      if (change === 'authentication') f.context.authenticated = false;
      if (change === 'destroyed') vi.spyOn(f.context.parent!, 'isDestroyed').mockReturnValue(true);
      if (change === 'expiry') vi.mocked(Date.now).mockReturnValue(now + DIAGNOSTIC_REVIEW_TTL_MS);
      return { canceled: false, filePath: f.destination };
    });
    await expect(f.exporter.exportFromDialog()).rejects.toThrow();
    expect(await fs.readdir(f.root)).toEqual([]);
  });

  it('sin autenticación no recopila ni muestra diálogos', async () => {
    const f = await fixture(); f.context.authenticated = false;
    await expect(f.exporter.exportFromDialog()).rejects.toThrow('perfil');
    expect(f.collect).not.toHaveBeenCalled(); expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('no sobrescribe un archivo existente y retira su temporal', async () => {
    const f = await fixture(); await fs.writeFile(f.destination, 'conservar');
    await expect(f.exporter.exportFromDialog()).rejects.toThrow('ya existe');
    expect(await fs.readFile(f.destination, 'utf8')).toBe('conservar');
    expect(await fs.readdir(f.root)).toEqual(['reporte.json']);
  });

  it('una invalidación durante la escritura temporal no publica el archivo', async () => {
    const f = await fixture(); const open = fs.open.bind(fs);
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args); f.context.generation++; return handle;
    });
    await expect(f.exporter.exportFromDialog()).rejects.toThrow('perfil');
    expect(await fs.readdir(f.root)).toEqual([]);
  });

  it('un error de filesystem no filtra rutas y permite reintentar', async () => {
    const f = await fixture();
    vi.spyOn(fs, 'link').mockRejectedValueOnce(new Error('EACCES C:/privado/token-ficticio'));
    await expect(f.exporter.exportFromDialog()).rejects.toThrow('No se pudo exportar el diagnóstico. Elige una carpeta local accesible y vuelve a intentarlo.');
    expect(await fs.readdir(f.root)).toEqual([]);
    expect(await f.exporter.exportFromDialog()).toEqual({ cancelled: false, exported: true });
  });

  it('un fallo de diálogo tampoco expone el error crudo', async () => {
    const f = await fixture(); vi.mocked(dialog.showMessageBox).mockRejectedValueOnce(new Error('token-ficticio'));
    await expect(f.exporter.exportFromDialog()).rejects.toThrow('No se pudo exportar el diagnóstico.');
    expect(await fs.readdir(f.root)).toEqual([]);
  });

  it.each(['reporte.json', 'C:\\reporte.txt'])('rechaza un destino no absoluto o no JSON: %s', async (destination) => {
    const f = await fixture(); vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: destination });
    await expect(f.exporter.exportFromDialog()).rejects.toThrow('destino JSON');
    expect(await fs.readdir(f.root)).toEqual([]);
  });

  it('mantiene una sola exportación pendiente y libera la cancelada', async () => {
    const f = await fixture();
    let resolve!: (value: { response: number; checkboxChecked: boolean }) => void;
    vi.mocked(dialog.showMessageBox).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const pending = f.exporter.exportFromDialog();
    await expect(f.exporter.exportFromDialog()).rejects.toThrow('pendiente');
    resolve({ response: 1, checkboxChecked: false });
    expect(await pending).toEqual({ cancelled: true, exported: false });
    expect(await f.exporter.exportFromDialog()).toEqual({ cancelled: false, exported: true });
  });
});
