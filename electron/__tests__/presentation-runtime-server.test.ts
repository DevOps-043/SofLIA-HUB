import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PresentationRuntimeServer } from '../skill-workspace/presentation-runtime-server';
import { SkillWorkspaceService } from '../skill-workspace/service';

const POLICY = {
  rootFolder: 'presentaciones', allowedExtensions: ['.json', '.md'], maxFileBytes: 512 * 1024,
  maxWorkspaceBytes: 8 * 1024 * 1024, entryFile: 'deck.json', protectedFiles: ['estilos/marca.css'],
};

const DECK = JSON.stringify({ version: 1, meta: { titulo: 'Demo', direccionVisual: 'Tecnico' }, slides: [
  { id: 'a', tipo: 'portada', titulo: 'Portada', movimiento: { continuidad: 'flujo', entrada: 'ascenso', enfasis: 'ninguno' } },
  { id: 'b', tipo: 'declaracion', titulo: 'Tesis', movimiento: { continuidad: 'zoom', entrada: 'foco', enfasis: 'ninguno' } },
  { id: 'c', tipo: 'cierre', titulo: 'Cierre', accion: 'Avanzar', movimiento: { continuidad: 'empuje', entrada: 'ascenso', enfasis: 'pulso' } },
] });

describe('servidor React de presentaciones', () => {
  let base: string;
  let dist: string;
  let service: SkillWorkspaceService;
  let server: PresentationRuntimeServer;
  let workspaceId: string;

  beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-react-deck-'));
    dist = path.join(base, 'dist');
    await fs.mkdir(dist);
    await fs.writeFile(path.join(dist, 'index.html'), '<div id="root"></div>');
    service = new SkillWorkspaceService(base);
    const created = await service.createWorkspace({ skillId: 'sistema:presentaciones', title: 'Demo', policy: POLICY });
    if (!created.ok) throw new Error(created.error);
    workspaceId = created.data.id;
    await service.writeFile(workspaceId, 'deck.json', DECK);
    await service.writeSystemFile(workspaceId, 'estilos/marca.css', ':root{}');
    server = new PresentationRuntimeServer(service, { rendererDist: dist });
  });

  afterEach(async () => { await server.stop(); await fs.rm(base, { recursive: true, force: true }); });

  it('sirve el player y el JSON mediante una sesion opaca', async () => {
    const url = await server.getUrl(workspaceId);
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/presentacion\/[a-f0-9-]+\/$/);
    expect(await (await fetch(url)).text()).toContain('root');
    const deckResponse = await fetch(`${url}deck.json`, { headers: { Origin: 'null' } });
    expect(deckResponse.status).toBe(200);
    expect(deckResponse.headers.get('access-control-allow-origin')).toBe('null');
    expect((await deckResponse.json()).version).toBe(1);
  });

  it('permite el origen opaco del preview y solo el origen Vite configurado', async () => {
    await server.stop();
    server = new PresentationRuntimeServer(service, {
      rendererDist: dist,
      devServerUrl: 'http://localhost:5173',
    });
    const url = await server.getUrl(workspaceId);

    const previewResponse = await fetch(`${url}deck.json`, { headers: { Origin: 'null' } });
    expect(previewResponse.headers.get('access-control-allow-origin')).toBe('null');

    const playbackResponse = await fetch(`${url}deck.json`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(playbackResponse.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(playbackResponse.headers.get('vary')).toBe('Origin');

    const foreignResponse = await fetch(`${url}deck.json`, {
      headers: { Origin: 'https://sitio-ajeno.example' },
    });
    expect(foreignResponse.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('no publica archivos arbitrarios del workspace', async () => {
    const url = await server.getUrl(workspaceId);
    expect((await fetch(`${url}guion.md`)).status).toBe(404);
    expect((await fetch(`${url}../deck.json`)).status).toBe(404);
  });

  it('falla antes de abrir una presentacion malformada', async () => {
    // Simula corrupcion externa: la API normal ya impide guardar un deck invalido.
    const workspaceRoot = await service.resolveWorkspaceRoot(workspaceId);
    if (!workspaceRoot) throw new Error('Workspace de prueba no encontrado');
    await fs.writeFile(path.join(workspaceRoot, 'deck.json'), '{"version":1}');
    await expect(server.getUrl(workspaceId)).rejects.toThrow('no cumple el contrato');
  });
});
