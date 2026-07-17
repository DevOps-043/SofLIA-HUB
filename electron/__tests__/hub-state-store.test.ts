import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Cliente del Hub simulado: sin red ni credenciales en tests.
const fakeDb = {
  remote: null as unknown,
  selectError: null as string | null,
  upserts: [] as Array<{ service_name: string; state_json: unknown }>,
  upsertError: null as string | null,
};

vi.mock('../hub-db-client', () => ({
  getHubDbClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => (
            fakeDb.selectError
              ? { data: null, error: { message: fakeDb.selectError } }
              : { data: fakeDb.remote === null ? null : { state_json: fakeDb.remote }, error: null }
          ),
        }),
      }),
      upsert: async (row: { service_name: string; state_json: unknown }) => {
        if (fakeDb.upsertError) return { error: { message: fakeDb.upsertError } };
        fakeDb.upserts.push({ service_name: row.service_name, state_json: row.state_json });
        return { error: null };
      },
    }),
  }),
}));

import { mirrorHubStateFile, restoreHubStateFile } from '../hub-state-store';

describe('hub-state-store', () => {
  let dir: string;
  let statePath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-state-'));
    statePath = path.join(dir, 'estado.json');
    fakeDb.remote = null;
    fakeDb.selectError = null;
    fakeDb.upsertError = null;
    fakeDb.upserts = [];
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('HS-001: con estado en el Hub, sobreescribe el archivo local antes de cargar', async () => {
    fs.writeFileSync(statePath, JSON.stringify({ variants: ['viejo-local'] }));
    fakeDb.remote = { variants: ['desde-hub'] };

    const result = await restoreHubStateFile('workflow-hub', statePath);

    expect(result).toBe('restaurado');
    expect(JSON.parse(fs.readFileSync(statePath, 'utf-8'))).toEqual({ variants: ['desde-hub'] });
  });

  it('HS-002: sin estado remoto, migra el archivo local existente al Hub', async () => {
    fs.writeFileSync(statePath, JSON.stringify({ variants: ['local'] }));

    const result = await restoreHubStateFile('workflow-hub', statePath);

    expect(result).toBe('migrado-local');
    expect(fakeDb.upserts).toEqual([{ service_name: 'workflow-hub', state_json: { variants: ['local'] } }]);
    // El archivo local no se toca.
    expect(JSON.parse(fs.readFileSync(statePath, 'utf-8'))).toEqual({ variants: ['local'] });
  });

  it('HS-003: sin remoto ni local no hace nada; sin red degrada al archivo local', async () => {
    expect(await restoreHubStateFile('workflow-hub', statePath)).toBe('vacio');

    fakeDb.selectError = 'fetch failed';
    fs.writeFileSync(statePath, JSON.stringify({ variants: ['local'] }));
    expect(await restoreHubStateFile('workflow-hub', statePath)).toBe('no-disponible');
    // El local sobrevive intacto para que el servicio arranque igual.
    expect(JSON.parse(fs.readFileSync(statePath, 'utf-8'))).toEqual({ variants: ['local'] });
  });

  it('HS-004: mirror espeja el archivo guardado y omite archivos corruptos', async () => {
    fs.writeFileSync(statePath, JSON.stringify({ runs: [1, 2] }));
    mirrorHubStateFile('workspace-automation', statePath);
    await vi.waitFor(() => expect(fakeDb.upserts).toHaveLength(1));
    expect(fakeDb.upserts[0]).toEqual({ service_name: 'workspace-automation', state_json: { runs: [1, 2] } });

    fs.writeFileSync(statePath, '{json roto');
    mirrorHubStateFile('workspace-automation', statePath);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fakeDb.upserts).toHaveLength(1); // basura no viaja al Hub
  });

  it('HS-005: un fallo del upsert en mirror no lanza (el guardado local ya ocurrio)', async () => {
    fakeDb.upsertError = 'sin conexion';
    fs.writeFileSync(statePath, JSON.stringify({ ok: true }));
    expect(() => mirrorHubStateFile('task-scheduler', statePath)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fakeDb.upserts).toHaveLength(0);
  });
});
