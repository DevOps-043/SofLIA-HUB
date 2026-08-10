import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportPresentationToHtml } from '../skill-workspace/export-html';
import { SkillWorkspaceService } from '../skill-workspace/service';
import type { SkillWorkspacePolicyInput } from '../skill-workspace/types';

const POLITICA: SkillWorkspacePolicyInput = {
  rootFolder: 'presentaciones',
  allowedExtensions: ['.html', '.css', '.md', '.js'],
  maxFileBytes: 256 * 1024,
  maxWorkspaceBytes: 2 * 1024 * 1024,
  entryFile: 'index.html',
  protectedFiles: ['estilos/marca.css'],
};

/**
 * La exportacion produce UN archivo HTML autocontenido en vez de un PDF:
 * imprimir aplanaria transiciones y animaciones, que son la razon de generar
 * la presentacion en HTML.
 */
describe('exportacion a HTML autocontenido', () => {
  let baseDir: string;
  let service: SkillWorkspaceService;
  let workspaceId: string;
  let root: string;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'export-html-'));
    service = new SkillWorkspaceService(baseDir);
    const created = await service.createWorkspace({
      skillId: 'sistema:presentaciones',
      title: 'Propuesta Acme',
      conversationId: 'conv-1',
      policy: POLITICA,
    });
    if (!created.ok) throw new Error(created.error);
    workspaceId = created.data.id;
    root = path.join(baseDir, 'presentaciones', workspaceId);

    await service.writeSystemFile(workspaceId, 'estilos/marca.css', ':root { --marca-color-primario: #123456 }');
    await service.writeFile(workspaceId, 'estilos/presentacion.css', '.diapositiva { transition: opacity 300ms }');
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  async function escribirEntrada(html: string) {
    await service.writeFile(workspaceId, 'index.html', html);
  }

  it('incrusta las hojas de estilo enlazadas', async () => {
    await escribirEntrada([
      '<!doctype html><html><head>',
      '<link rel="stylesheet" href="estilos/marca.css">',
      '<link rel="stylesheet" href="estilos/presentacion.css">',
      '</head><body><section class="diapositiva">Hola</section></body></html>',
    ].join(''));

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido).toContain('--marca-color-primario: #123456');
    expect(contenido).toContain('transition: opacity 300ms');
    expect(contenido).not.toContain('<link rel="stylesheet"');
  });

  it('conserva el orden: la marca antes que los estilos propios', async () => {
    // Si se invirtiera, los estilos propios dejarian de poder apoyarse en las
    // variables de marca y la identidad se rompe.
    await escribirEntrada([
      '<!doctype html><html><head>',
      '<link rel="stylesheet" href="estilos/marca.css">',
      '<link rel="stylesheet" href="estilos/presentacion.css">',
      '</head><body></body></html>',
    ].join(''));

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido.indexOf('marca-color-primario')).toBeLessThan(contenido.indexOf('transition: opacity'));
  });

  it('convierte las imagenes locales a data URI', async () => {
    await fs.mkdir(path.join(root, 'assets'), { recursive: true });
    await fs.writeFile(path.join(root, 'assets', 'logo.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await escribirEntrada('<!doctype html><html><body><img src="assets/logo.png"></body></html>');

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido).toContain('data:image/png;base64,');
    expect(contenido).not.toContain('src="assets/logo.png"');
  });

  it('tambien incrusta las imagenes referenciadas desde el CSS', async () => {
    // El logo de marca vive en `url(assets/logo.png)` dentro de marca.css.
    await fs.mkdir(path.join(root, 'assets'), { recursive: true });
    await fs.writeFile(path.join(root, 'assets', 'logo.png'), Buffer.from([137, 80, 78, 71]));
    await service.writeSystemFile(workspaceId, 'estilos/marca.css', ":root { --marca-logo: url('assets/logo.png') }");
    await escribirEntrada('<!doctype html><html><head><link rel="stylesheet" href="estilos/marca.css"></head><body></body></html>');

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido).toContain('data:image/png;base64,');
  });

  it('el archivo resultante no depende de la red', async () => {
    await escribirEntrada([
      '<!doctype html><html><head>',
      '<link rel="stylesheet" href="estilos/presentacion.css">',
      '<link rel="stylesheet" href="https://cdn.example.com/tema.css">',
      '</head><body></body></html>',
    ].join(''));

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido).not.toContain('cdn.example.com');
    expect(contenido).not.toMatch(/<link[^>]*stylesheet/i);
  });

  it('no incrusta archivos de fuera del workspace', async () => {
    const secreto = path.join(baseDir, 'secreto.css');
    await fs.writeFile(secreto, 'body { content: "privado" }', 'utf-8');
    await escribirEntrada('<!doctype html><html><head><link rel="stylesheet" href="../../secreto.css"></head><body></body></html>');

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido).not.toContain('privado');
  });

  it('conserva el JavaScript en linea de la navegacion', async () => {
    await escribirEntrada('<!doctype html><html><body><script>document.addEventListener("keydown", () => {});</script></body></html>');

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido).toContain('addEventListener');
  });

  it('incrusta el guion base para que el archivo llegue con animaciones', async () => {
    // Si el `<script src>` se quedara apuntando al archivo, la presentacion
    // compartida llegaria estatica: el guion es el que dispara las entradas.
    await service.writeSystemFile(workspaceId, 'guion-base.js', 'window.__deck = "activo";');
    await escribirEntrada('<!doctype html><html><body><script src="guion-base.js"></script></body></html>');

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido).toContain('window.__deck');
    expect(contenido).not.toContain('src="guion-base.js"');
  });

  it('descarta un guion remoto en vez de dejar el archivo dependiendo de la red', async () => {
    await escribirEntrada('<!doctype html><html><body><script src="https://cdn.ejemplo.com/x.js"></script></body></html>');

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contenido = await fs.readFile(result.htmlPath, 'utf-8');
    expect(contenido).not.toContain('cdn.ejemplo.com');
  });

  it('falla con mensaje claro si no hay documento de entrada', async () => {
    const vacio = await service.createWorkspace({
      skillId: 'sistema:presentaciones',
      title: 'Sin nada',
      conversationId: null,
      policy: POLITICA,
    });
    if (!vacio.ok) throw new Error(vacio.error);

    const result = await exportPresentationToHtml(service, vacio.data.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('todavia no tiene un documento');
  });

  it('nombra el archivo con el titulo de la presentacion', async () => {
    await escribirEntrada('<!doctype html><html><body>ok</body></html>');

    const result = await exportPresentationToHtml(service, workspaceId);

    expect(result.ok).toBe(true);
    if (result.ok) expect(path.basename(result.htmlPath)).toBe('propuesta-acme.html');
  });
});
