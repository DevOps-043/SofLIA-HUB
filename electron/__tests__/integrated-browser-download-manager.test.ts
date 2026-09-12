import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DownloadItem, Session, WebContents } from 'electron';
import { BrowserDownloadManager, sanitizeDownloadFilename } from '../integrated-browser/download-manager';

class FakeDownload extends EventEmitter {
  received = 0;
  total = 100;
  resumable = false;
  url = 'https://files.example.com/reporte.pdf';
  filename = 'reporte.pdf';
  getURL = vi.fn(() => this.url);
  getFilename = vi.fn(() => this.filename);
  getReceivedBytes = vi.fn(() => this.received);
  getTotalBytes = vi.fn(() => this.total);
  canResume = vi.fn(() => this.resumable);
  setSavePath = vi.fn();
  cancel = vi.fn();
  resume = vi.fn();
}

const roots: string[] = [];
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })); });

function harness(guard?: (source: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-downloads-'));
  roots.push(root);
  const session = new EventEmitter();
  const changes = vi.fn();
  const manager = new BrowserDownloadManager(changes, root, guard);
  manager.attach(session as unknown as Session);
  return { root, session, changes, manager };
}

describe('BrowserDownloadManager', () => {
  it('reserva nombres distintos aunque las descargas simultáneas aún no creen archivos', () => {
    const { root, session } = harness();
    const first = new FakeDownload(); const second = new FakeDownload();
    session.emit('will-download', {}, first); session.emit('will-download', {}, second);
    expect(first.setSavePath).toHaveBeenCalledWith(path.join(root, 'reporte.pdf'));
    expect(second.setSavePath).toHaveBeenCalledWith(path.join(root, 'reporte (1).pdf'));
  });

  it('limita descargas activas sin expulsarlas de los controles al crecer el historial', () => {
    const { session, manager } = harness();
    for (let index = 0; index < 20; index += 1) session.emit('will-download', {}, new FakeDownload());
    const active = manager.list().map((download) => download.id);
    for (let index = 0; index < 220; index += 1) {
      const blocked = new FakeDownload(); session.emit('will-download', {}, blocked);
      expect(blocked.cancel).toHaveBeenCalled();
    }
    expect(manager.list()).toHaveLength(200);
    for (const id of active) expect(manager.cancel(id).state).toBe('cancelled');
  });

  it('no resucita una descarga cancelada al recibir eventos tardíos', () => {
    const { session, manager } = harness(); const item = new FakeDownload();
    session.emit('will-download', {}, item); manager.cancel(manager.list()[0].id);
    item.emit('updated', {}, 'progressing'); item.emit('done', {}, 'completed');
    expect(manager.list()[0].state).toBe('cancelled');
  });

  it('cancela descargas pendientes y descarta eventos del perfil anterior', () => {
    const { session, manager } = harness();
    const item = new FakeDownload();
    session.emit('will-download', {}, item);
    const id = manager.list()[0].id;
    manager.resetForProfileChange();
    expect(item.cancel).toHaveBeenCalled();
    item.emit('done', {}, 'completed');
    expect(manager.list()).toEqual([]);
    expect(() => manager.reveal(id)).toThrow('no existe');
    const late = new FakeDownload();
    session.emit('will-download', {}, late);
    expect(late.cancel).toHaveBeenCalled();
    expect(manager.list()).toEqual([]);
    manager.attach(session as unknown as Session);
    const next = new FakeDownload();
    session.emit('will-download', {}, next);
    expect(manager.list()).toHaveLength(1);
  });

  it('sanea nombre, fija Descargas y publica progreso hasta completar', () => {
    const { root, session, manager } = harness();
    const item = new FakeDownload();
    item.filename = '../reporte?.pdf';
    session.emit('will-download', {}, item as unknown as DownloadItem);

    expect(item.setSavePath).toHaveBeenCalledWith(path.join(root, 'reporte_.pdf'));
    const id = manager.list()[0].id;
    item.received = 50;
    item.emit('updated', {}, 'progressing');
    expect(manager.list()[0]).toMatchObject({ id, progress: 0.5, state: 'progressing', origin: 'https://files.example.com' });
    item.received = 100;
    item.emit('done', {}, 'completed');
    expect(manager.list()[0]).toMatchObject({ progress: 1, state: 'completed', completedAt: expect.any(String) });
  });

  it('bloquea protocolos no HTTP sin escribir un destino', () => {
    const { session, manager } = harness();
    const item = new FakeDownload();
    item.url = 'file:///C:/secreto.txt';
    session.emit('will-download', {}, item as unknown as DownloadItem);
    expect(item.cancel).toHaveBeenCalled();
    expect(item.setSavePath).not.toHaveBeenCalled();
    expect(manager.list()[0]).toMatchObject({ state: 'blocked', canResume: false });
  });

  it('aplica la guardia de navegación a descargas HTTP antes de reservar destino', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-downloads-safe-'));
    roots.push(root);
    const session = new EventEmitter();
    const changes = vi.fn();
    const manager = new BrowserDownloadManager(changes, root, (sourceUrl) => {
      if (sourceUrl.includes('credenciales')) throw new Error('La descarga está bloqueada por la protección local.');
    });
    manager.attach(session as unknown as Session);
    const item = new FakeDownload(); item.url = 'https://credenciales.example/reporte.pdf';
    session.emit('will-download', {}, item as unknown as DownloadItem);
    expect(item.cancel).toHaveBeenCalled();
    expect(item.setSavePath).not.toHaveBeenCalled();
    expect(manager.list()[0]).toMatchObject({ state: 'blocked', error: expect.stringMatching(/protección local/) });
  });

  it('reanuda sólo cuando Electron conserva una descarga recuperable', () => {
    const { session, manager } = harness();
    const item = new FakeDownload();
    item.resumable = true;
    session.emit('will-download', {}, item as unknown as DownloadItem);
    item.emit('done', {}, 'interrupted');
    manager.resume(manager.list()[0].id);
    expect(item.resume).toHaveBeenCalled();
  });

  it('cancela y conserva el registro para volver a abrir el panel', () => {
    const { session, manager } = harness();
    const item = new FakeDownload();
    session.emit('will-download', {}, item as unknown as DownloadItem);
    const id = manager.list()[0].id;
    expect(manager.cancel(id)).toMatchObject({ id, state: 'cancelled' });
    expect(item.cancel).toHaveBeenCalled();
    expect(manager.list()).toEqual([expect.objectContaining({ id, state: 'cancelled' })]);
  });

  it('neutraliza nombres reservados y recorridos', () => {
    expect(sanitizeDownloadFilename('../../factura?.pdf')).toBe('factura_.pdf');
    expect(sanitizeDownloadFilename('CON.txt')).toMatch(/^descarga-/);
  });

  it('revalida la política antes de reanudar o reintentar', () => {
    let allowed = true;
    const { manager, session } = harness(() => { if (!allowed) throw new Error('Origen revocado.'); });
    const item = new FakeDownload(); item.resumable = true;
    session.emit('will-download', {}, item);
    item.emit('done', {}, 'interrupted');
    const id = manager.list()[0].id;
    allowed = false;
    expect(() => manager.resume(id)).toThrow(/revocado/);
    const contents = { downloadURL: vi.fn() };
    expect(() => manager.retry(id, contents as unknown as WebContents)).toThrow(/revocado/);
    expect(item.resume).not.toHaveBeenCalled();
    expect(contents.downloadURL).not.toHaveBeenCalled();
  });

  it('no publica rutas ni detalles internos de un error de destino', () => {
    const { session, manager } = harness();
    vi.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => { throw new Error('EACCES C:/Usuarios/secreto/Descargas'); });
    const item = new FakeDownload();
    session.emit('will-download', {}, item);
    expect(manager.list()[0]).toMatchObject({ state: 'blocked', error: 'No se pudo preparar un destino seguro en Descargas.' });
    expect(item.cancel).toHaveBeenCalledOnce();
  });
});
