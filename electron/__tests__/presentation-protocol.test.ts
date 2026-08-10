import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { protocol, session } from 'electron';

/**
 * El mock de Electron expone ayudantes de limpieza que los tipos reales no
 * declaran. Se acotan aqui, como hacen las demas pruebas de main.
 */
const protocolHarness = protocol as unknown as {
  _clearHandlers: () => void;
  isProtocolHandled: (scheme: string) => boolean;
};
const sessionHarness = session as unknown as {
  _clearPartitions: () => void;
  fromPartition: (partition: string) => { protocol: { isProtocolHandled: (scheme: string) => boolean } };
};
import { SkillWorkspaceService } from '../skill-workspace/service';
import {
  PRESENTATION_CSP,
  PRESENTATION_PARTITION,
  PRESENTATION_SCHEME,
  buildPresentationUrl,
  parsePresentationUrl,
  registerPresentationProtocolHandler,
  resolvePresentationRequest,
} from '../skill-workspace/protocol';
import type { SkillWorkspacePolicyInput } from '../skill-workspace/types';

const POLITICA: SkillWorkspacePolicyInput = {
  rootFolder: 'presentaciones',
  allowedExtensions: ['.html', '.css', '.md', '.js'],
  maxFileBytes: 64 * 1024,
  maxWorkspaceBytes: 512 * 1024,
  entryFile: 'index.html',
};

describe('protocolo local de presentaciones', () => {
  let baseDir: string;
  let service: SkillWorkspaceService;
  let workspaceId: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'presentacion-proto-'));
    service = new SkillWorkspaceService(baseDir);
    const created = await service.createWorkspace({
      skillId: 'sistema:presentaciones',
      title: 'Demo',
      conversationId: 'conv-1',
      policy: POLITICA,
    });
    if (!created.ok) throw new Error(created.error);
    workspaceId = created.data.id;
    await service.writeFile(workspaceId, 'index.html', '<!doctype html><h1>Hola</h1>');
    await service.writeFile(workspaceId, 'estilos/presentacion.css', 'body { margin: 0 }');
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('sirve el documento de entrada del workspace', async () => {
    const result = await resolvePresentationRequest(service, buildPresentationUrl(workspaceId, 'index.html'));

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.toString('utf-8')).toContain('<h1>Hola</h1>');
      expect(result.headers['Content-Type']).toContain('text/html');
    }
  });

  it('sirve recursos relativos del workspace', async () => {
    const result = await resolvePresentationRequest(service, buildPresentationUrl(workspaceId, 'estilos/presentacion.css'));

    expect(result.status).toBe(200);
    if (result.status === 200) expect(result.headers['Content-Type']).toContain('text/css');
  });

  it('sirve el guion base de la baraja', async () => {
    // Sin este tipo MIME el visor devolvia 404 y la presentacion se veia
    // estatica: el guion es el que dispara las entradas de cada diapositiva.
    await service.writeFile(workspaceId, 'guion-base.js', 'window.__deck = 1;');

    const result = await resolvePresentationRequest(service, buildPresentationUrl(workspaceId, 'guion-base.js'));

    expect(result.status).toBe(200);
    if (result.status === 200) expect(result.headers['Content-Type']).toContain('javascript');
  });

  it('aplica una CSP que bloquea cualquier origen externo', async () => {
    const result = await resolvePresentationRequest(service, buildPresentationUrl(workspaceId, 'index.html'));

    expect(result.status).toBe(200);
    if (result.status === 200) {
      const csp = result.headers['Content-Security-Policy'];
      // Fuentes por esquema, NO `'self'`: la vista previa se embebe en un
      // iframe con sandbox sin `allow-same-origin`, y en un origen opaco
      // `'self'` no coincide con nada — su propio CSS quedaria bloqueado.
      expect(csp).toContain("default-src 'none'");
      expect(csp).not.toContain("'self'");
      expect(csp).toContain(`style-src ${PRESENTATION_SCHEME}:`);
      expect(csp).toContain(`img-src ${PRESENTATION_SCHEME}:`);
      // Sin `connect-src` el documento no puede llamar a ningun servidor,
      // que es lo que hace verificable el requisito de "renderiza sin conexion".
      expect(csp).toContain("connect-src 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("form-action 'none'");
      expect(csp).not.toContain('http://');
      expect(csp).not.toContain('https://');
    }
  });

  it('devuelve 404 para una ruta fuera de la raiz del workspace', async () => {
    const result = await resolvePresentationRequest(service, `pulse-presentacion://${workspaceId}/../../workspaces.json`);

    expect(result.status).toBe(404);
  });

  it('devuelve 404 para un workspace que no existe', async () => {
    const result = await resolvePresentationRequest(service, 'pulse-presentacion://inventado/index.html');

    expect(result.status).toBe(404);
  });

  it('no sirve un archivo enlazado hacia fuera del workspace', async () => {
    const externo = path.join(baseDir, 'secreto.html');
    await fs.writeFile(externo, '<p>privado</p>', 'utf-8');
    try {
      await fs.symlink(externo, path.join(baseDir, 'presentaciones', workspaceId, 'fuga.html'));
    } catch {
      return;
    }

    const result = await resolvePresentationRequest(service, buildPresentationUrl(workspaceId, 'fuga.html'));

    expect(result.status).toBe(404);
  });

  it('devuelve 404 para una extension sin tipo conocido', async () => {
    await fs.writeFile(path.join(baseDir, 'presentaciones', workspaceId, 'notas.txt'), 'texto', 'utf-8');

    const result = await resolvePresentationRequest(service, buildPresentationUrl(workspaceId, 'notas.txt'));

    expect(result.status).toBe(404);
  });

  it('rechaza una URL de otro protocolo', async () => {
    const result = await resolvePresentationRequest(service, 'file:///etc/passwd');

    expect(result.status).toBe(404);
  });

  it('declara nosniff y sin cache', async () => {
    const result = await resolvePresentationRequest(service, buildPresentationUrl(workspaceId, 'index.html'));

    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(result.headers['Cache-Control']).toBe('no-store');
    }
  });
});

describe('URLs del protocolo', () => {
  it('construye y vuelve a leer la misma ruta', () => {
    const url = buildPresentationUrl('demo-123', 'estilos/presentacion.css');

    expect(parsePresentationUrl(url)).toEqual({ workspaceId: 'demo-123', relativePath: 'estilos/presentacion.css' });
  });

  it('usa el documento de entrada cuando la ruta viene vacia', () => {
    expect(parsePresentationUrl('pulse-presentacion://demo-123/')?.relativePath).toBe('index.html');
  });

  it('rechaza una URL sin workspace', () => {
    expect(parsePresentationUrl('pulse-presentacion:///index.html')).toBeNull();
  });

  it('rechaza una URL malformada', () => {
    expect(parsePresentationUrl('no es una url')).toBeNull();
  });

  it('la CSP no permite recursos remotos', () => {
    expect(PRESENTATION_CSP).not.toMatch(/https?:/);
  });
});

describe('registro del esquema por sesion', () => {
  let baseDir: string;
  let service: SkillWorkspaceService;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'presentacion-sesion-'));
    service = new SkillWorkspaceService(baseDir);
    protocolHarness._clearHandlers();
    sessionHarness._clearPartitions();
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  /**
   * Regresion: el handler solo se registraba en la sesion por defecto. La
   * vista a pantalla completa usa una particion propia, cuya sesion quedaba
   * sin protocolo: Electron entregaba `pulse-presentacion://` al sistema
   * operativo, Windows mostraba "obten una aplicacion para abrir este
   * vinculo" y la ventana quedaba en blanco.
   */
  it('registra el handler en la sesion de la particion de la vista', () => {
    registerPresentationProtocolHandler(service);

    expect(sessionHarness.fromPartition(PRESENTATION_PARTITION).protocol.isProtocolHandled(PRESENTATION_SCHEME)).toBe(true);
  });

  it('registra el handler tambien en la sesion por defecto, que usa el iframe', () => {
    registerPresentationProtocolHandler(service);

    expect(protocolHarness.isProtocolHandled(PRESENTATION_SCHEME)).toBe(true);
  });

  it('registrar dos veces no tumba el proceso principal', () => {
    registerPresentationProtocolHandler(service);

    expect(() => registerPresentationProtocolHandler(service)).not.toThrow();
  });
});
