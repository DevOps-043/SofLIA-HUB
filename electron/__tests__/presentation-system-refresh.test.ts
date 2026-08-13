import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DECK_BASE_JS } from '../organization-branding/deck-base-js';
import { refreshPresentationSystem } from '../presentation-system-refresh';
import { SkillWorkspaceService } from '../skill-workspace/service';

describe('actualizacion del motor de una presentacion persistente', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'presentation-system-'));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('sustituye el guion con zoom por el motor actual al volver a abrir', async () => {
    const service = new SkillWorkspaceService(baseDir);
    const created = await service.createWorkspace({
      skillId: 'sistema:presentaciones',
      title: 'Deck antiguo',
      policy: {
        rootFolder: 'presentaciones',
        allowedExtensions: ['.html', '.css', '.js'],
        maxFileBytes: 1024 * 1024,
        maxWorkspaceBytes: 4 * 1024 * 1024,
        entryFile: 'index.html',
        protectedFiles: ['estilos/base.css', 'guion-base.js'],
      },
    });
    if (!created.ok) throw new Error(created.error);
    await service.writeSystemFile(created.data.id, 'estilos/base.css', '.diapositiva{}');
    await service.writeSystemFile(created.data.id, 'guion-base.js', "caja.style.zoom = '0.7';");

    const result = await refreshPresentationSystem(service, created.data.id);
    const guion = await service.readFile(created.data.id, 'guion-base.js');

    expect(result).toEqual({ ok: true });
    expect(guion.ok && guion.data).toBe(DECK_BASE_JS);
    expect(guion.ok && guion.data).not.toContain('caja.style.zoom');
  });

  it('es idempotente ante aperturas concurrentes', async () => {
    const service = new SkillWorkspaceService(baseDir);
    const created = await service.createWorkspace({
      skillId: 'sistema:presentaciones',
      title: 'Deck concurrente',
      policy: {
        rootFolder: 'presentaciones',
        allowedExtensions: ['.html', '.css', '.js'],
        maxFileBytes: 1024 * 1024,
        maxWorkspaceBytes: 4 * 1024 * 1024,
        entryFile: 'index.html',
        protectedFiles: ['estilos/base.css', 'guion-base.js'],
      },
    });
    if (!created.ok) throw new Error(created.error);
    await service.writeSystemFile(created.data.id, 'estilos/base.css', 'viejo');
    await service.writeSystemFile(created.data.id, 'guion-base.js', 'viejo');

    const resultados = await Promise.all([
      refreshPresentationSystem(service, created.data.id),
      refreshPresentationSystem(service, created.data.id),
      refreshPresentationSystem(service, created.data.id),
    ]);
    const root = await service.resolveWorkspaceRoot(created.data.id);
    const archivosBase = await fs.readdir(path.join(String(root), 'estilos'));
    const archivosRoot = await fs.readdir(String(root));

    expect(resultados).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(archivosBase).toEqual(['base.css']);
    expect(archivosRoot.filter((nombre) => nombre.endsWith('.parcial'))).toEqual([]);
  });

  it('rechaza un identificador vacio', async () => {
    const service = new SkillWorkspaceService(baseDir);
    expect(await refreshPresentationSystem(service, '  ')).toEqual({
      ok: false,
      error: 'El espacio de trabajo indicado no es valido.',
    });
  });
});
