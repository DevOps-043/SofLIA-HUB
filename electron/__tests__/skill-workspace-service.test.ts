import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillWorkspaceService } from '../skill-workspace/service';
import type { SkillWorkspacePolicyInput, SkillWorkspaceProgressEvent } from '../skill-workspace/types';

const POLITICA: SkillWorkspacePolicyInput = {
  rootFolder: 'presentaciones',
  allowedExtensions: ['.html', '.css', '.md'],
  maxFileBytes: 1024,
  maxWorkspaceBytes: 4096,
  entryFile: 'index.html',
  protectedFiles: ['estilos/marca.css', 'estilos/base.css'],
};

const DECK_VALIDO = JSON.stringify({
  version: 1,
  meta: { titulo: 'Demo', direccionVisual: 'Editorial tecnico y sobrio' },
  slides: [
    { id: 'inicio', tipo: 'portada', titulo: 'Inicio', movimiento: { continuidad: 'flujo', entrada: 'revelado', enfasis: 'ninguno' } },
    { id: 'tesis', tipo: 'declaracion', titulo: 'Tesis', movimiento: { continuidad: 'zoom', entrada: 'foco', enfasis: 'ninguno' } },
    { id: 'fin', tipo: 'cierre', titulo: 'Fin', accion: 'Continuar', movimiento: { continuidad: 'empuje', entrada: 'ascenso', enfasis: 'pulso' } },
  ],
});

describe('servicio de espacio de trabajo de skills', () => {
  let baseDir: string;
  let service: SkillWorkspaceService;
  let progreso: SkillWorkspaceProgressEvent[];

  async function crearWorkspace(conversationId: string | null = 'conv-1') {
    const created = await service.createWorkspace({
      skillId: 'sistema:presentaciones',
      title: 'Propuesta Acme',
      conversationId,
      policy: POLITICA,
    });
    if (!created.ok) throw new Error(created.error);
    return created.data;
  }

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-ws-svc-'));
    service = new SkillWorkspaceService(baseDir);
    progreso = [];
    service.on('progreso', (event: SkillWorkspaceProgressEvent) => progreso.push(event));
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  describe('ciclo de vida', () => {
    it('crea el workspace y lo asocia a la conversacion', async () => {
      const workspace = await crearWorkspace('conv-42');

      expect(workspace.entryFile).toBe('index.html');
      const encontrado = await service.findByConversation('conv-42');
      expect(encontrado?.id).toBe(workspace.id);
    });

    it('no devuelve workspaces de otra conversacion', async () => {
      await crearWorkspace('conv-1');

      expect(await service.findByConversation('conv-2')).toBeNull();
    });

    it('ata a la conversacion el workspace que nacio sin ella', async () => {
      // En un chat nuevo la Skill se activa ANTES de que exista la
      // conversacion: se crea al guardar el primer mensaje. Sin este enlace la
      // presentacion quedaba en disco pero inalcanzable al reabrir el chat.
      const workspace = await crearWorkspace(null);
      expect(await service.findByConversation('conv-nueva')).toBeNull();

      const atado = await service.attachConversation(workspace.id, 'conv-nueva');

      expect(atado.ok).toBe(true);
      expect((await service.findByConversation('conv-nueva'))?.id).toBe(workspace.id);
    });

    it('no le roba la presentacion a la conversacion que ya la tiene', async () => {
      const workspace = await crearWorkspace('conv-duena');

      const atado = await service.attachConversation(workspace.id, 'conv-intrusa');

      expect(atado.ok).toBe(false);
      expect((await service.findByConversation('conv-duena'))?.id).toBe(workspace.id);
      expect(await service.findByConversation('conv-intrusa')).toBeNull();
    });

    it('atar dos veces a la misma conversacion no falla', async () => {
      const workspace = await crearWorkspace(null);
      await service.attachConversation(workspace.id, 'conv-nueva');

      expect((await service.attachConversation(workspace.id, 'conv-nueva')).ok).toBe(true);
    });

    it('poner al dia el sistema de diseno no anuncia nada al panel', async () => {
      // El panel se alimenta de los eventos de progreso: al anunciarlos,
      // recargaba su listado, la recarga volvia a pedir la vista previa y esta
      // refrescaba otra vez. Los archivos parpadeaban sin parar.
      const workspace = await crearWorkspace();
      progreso.length = 0;

      const puesta = await service.refreshSystemFile(workspace.id, 'estilos/base.css', '.diapositiva{}');

      expect(puesta).toEqual({ ok: true, data: true });
      expect(progreso).toEqual([]);
    });

    it('no reescribe el sistema de diseno si no cambio', async () => {
      const workspace = await crearWorkspace();
      await service.refreshSystemFile(workspace.id, 'estilos/base.css', '.diapositiva{}');

      const segunda = await service.refreshSystemFile(workspace.id, 'estilos/base.css', '.diapositiva{}');

      expect(segunda).toEqual({ ok: true, data: false });
    });

    it('el enlace sobrevive al reinicio de la aplicacion', async () => {
      const workspace = await crearWorkspace(null);
      await service.attachConversation(workspace.id, 'conv-nueva');

      // Un servicio nuevo sobre el mismo directorio: es lo que ocurre al abrir
      // la aplicacion de nuevo y volver a esa conversacion.
      const reabierto = new SkillWorkspaceService(baseDir);

      expect((await reabierto.findByConversation('conv-nueva'))?.id).toBe(workspace.id);
    });

    it('rechaza operar sobre un workspace inexistente', async () => {
      const result = await service.writeFile('no-existe', 'index.html', '<p>hola</p>');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('no existe');
    });

    it('refresca un archivo protegido sin anunciar progreso ni tocar uno editable', async () => {
      const workspace = await crearWorkspace();
      const eventos: SkillWorkspaceProgressEvent[] = [];
      service.on('progreso', (evento: SkillWorkspaceProgressEvent) => eventos.push(evento));
      await service.writeSystemFile(workspace.id, 'estilos/base.css', 'version-antigua');
      eventos.length = 0;

      const primera = await service.refreshSystemFile(workspace.id, 'estilos/base.css', 'version-nueva');
      const segunda = await service.refreshSystemFile(workspace.id, 'estilos/base.css', 'version-nueva');
      const editable = await service.refreshSystemFile(workspace.id, 'index.html', '<main></main>');

      expect(primera).toEqual({ ok: true, data: true });
      expect(segunda).toEqual({ ok: true, data: false });
      expect(editable.ok).toBe(false);
      expect(eventos).toEqual([]);
    });

    it('informa que no esta listo hasta que exista el documento de entrada', async () => {
      const workspace = await crearWorkspace();
      await service.writeFile(workspace.id, 'guion.md', '# Guion');

      const antes = await service.getState(workspace.id);
      expect(antes.ok && antes.data.ready).toBe(false);

      await service.writeFile(workspace.id, 'index.html', '<!doctype html>');
      const despues = await service.getState(workspace.id);
      expect(despues.ok && despues.data.ready).toBe(true);
    });
  });

  describe('escritura', () => {
    it('escribe un archivo y lo lista con su tamano', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeFile(workspace.id, 'estilos/presentacion.css', 'body { margin: 0 }');

      expect(result.ok).toBe(true);
      const state = await service.getState(workspace.id);
      expect(state.ok && state.data.files.map((file) => file.path)).toContain('estilos/presentacion.css');
    });

    it('rechaza una extension no declarada por la skill', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeFile(workspace.id, 'script.js', 'alert(1)');

      expect(result.ok).toBe(false);
      const state = await service.getState(workspace.id);
      expect(state.ok && state.data.files).toHaveLength(0);
    });

    it('rechaza un archivo que supera el limite por archivo', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeFile(workspace.id, 'index.html', 'x'.repeat(2048));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('limite');
      const state = await service.getState(workspace.id);
      expect(state.ok && state.data.files).toHaveLength(0);
    });

    it('rechaza cuando el workspace alcanza su limite total', async () => {
      const workspace = await crearWorkspace();
      await service.writeFile(workspace.id, 'index.html', 'a'.repeat(1000));
      await service.writeFile(workspace.id, 'guion.md', 'b'.repeat(1000));
      await service.writeFile(workspace.id, 'estilos/presentacion.css', 'c'.repeat(1000));
      await service.writeFile(workspace.id, 'estilos/extra.css', 'd'.repeat(1000));

      const result = await service.writeFile(workspace.id, 'estilos/otro.css', 'e'.repeat(1000));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('limite');
    });

    it('no deja archivos parciales si la escritura falla', async () => {
      const workspace = await crearWorkspace();
      const fallo = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('disco lleno'));

      const result = await service.writeFile(workspace.id, 'index.html', '<!doctype html>');

      expect(result.ok).toBe(false);
      const state = await service.getState(workspace.id);
      expect(state.ok && state.data.files.map((file) => file.path)).not.toContain('index.html');
      fallo.mockRestore();
    });

    it('rechaza escribir fuera del workspace', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeFile(workspace.id, '../../fuga.html', '<p>fuga</p>');

      expect(result.ok).toBe(false);
    });

    it('rechaza un deck React invalido antes de reemplazar el archivo', async () => {
      const created = await service.createWorkspace({
        skillId: 'sistema:presentaciones',
        title: 'Deck React',
        conversationId: 'conv-react',
        policy: {
          rootFolder: 'presentaciones',
          allowedExtensions: ['.json', '.md'],
          maxFileBytes: 16 * 1024,
          maxWorkspaceBytes: 64 * 1024,
          entryFile: 'deck.json',
          protectedFiles: ['estilos/marca.css'],
        },
      });
      if (!created.ok) throw new Error(created.error);

      const invalido = await service.writeFile(created.data.id, 'deck.json', '{"version":1,"slides":[]}');

      expect(invalido.ok).toBe(false);
      if (!invalido.ok) expect(invalido.error).toContain('no cumple el contrato');
      const state = await service.getState(created.data.id);
      expect(state.ok && state.data.ready).toBe(false);
      expect(state.ok && state.data.files.some((file) => file.path === 'deck.json')).toBe(false);

      expect((await service.writeFile(created.data.id, 'deck.json', DECK_VALIDO)).ok).toBe(true);
      const listo = await service.getState(created.data.id);
      expect(listo.ok && listo.data.ready).toBe(true);
    });
  });

  describe('edicion por reemplazo exacto', () => {
    it('reemplaza un fragmento unico y conserva el resto', async () => {
      const workspace = await crearWorkspace();
      await service.writeFile(workspace.id, 'index.html', '<h1>Titulo viejo</h1><p>Cuerpo</p>');

      const result = await service.editFile(workspace.id, 'index.html', 'Titulo viejo', 'Titulo nuevo');

      expect(result.ok).toBe(true);
      const leido = await service.readFile(workspace.id, 'index.html');
      expect(leido.ok && leido.data).toBe('<h1>Titulo nuevo</h1><p>Cuerpo</p>');
    });

    it('falla sin modificar cuando el fragmento no existe', async () => {
      const workspace = await crearWorkspace();
      await service.writeFile(workspace.id, 'index.html', '<h1>Titulo</h1>');

      const result = await service.editFile(workspace.id, 'index.html', 'Inexistente', 'Otro');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('no existe');
      const leido = await service.readFile(workspace.id, 'index.html');
      expect(leido.ok && leido.data).toBe('<h1>Titulo</h1>');
    });

    it('falla sin modificar cuando el fragmento es ambiguo', async () => {
      const workspace = await crearWorkspace();
      await service.writeFile(workspace.id, 'index.html', '<p>dato</p><p>dato</p>');

      const result = await service.editFile(workspace.id, 'index.html', 'dato', 'cifra');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('2 veces');
      const leido = await service.readFile(workspace.id, 'index.html');
      expect(leido.ok && leido.data).toBe('<p>dato</p><p>dato</p>');
    });

    it('reemplaza todas las ocurrencias cuando se pide explicitamente', async () => {
      const workspace = await crearWorkspace();
      await service.writeFile(workspace.id, 'index.html', '<p>dato</p><p>dato</p>');

      const result = await service.editFile(workspace.id, 'index.html', 'dato', 'cifra', true);

      expect(result.ok).toBe(true);
      const leido = await service.readFile(workspace.id, 'index.html');
      expect(leido.ok && leido.data).toBe('<p>cifra</p><p>cifra</p>');
    });

    it('rechaza editar un archivo que no existe', async () => {
      const workspace = await crearWorkspace();

      const result = await service.editFile(workspace.id, 'index.html', 'a', 'b');

      expect(result.ok).toBe(false);
    });
  });

  describe('archivos protegidos', () => {
    it('el sistema puede escribir la hoja de marca', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeSystemFile(workspace.id, 'estilos/marca.css', ':root { --marca-color-primario: #123456 }');

      expect(result.ok).toBe(true);
    });

    it('el modelo no puede sobrescribir la hoja de marca', async () => {
      const workspace = await crearWorkspace();
      await service.writeSystemFile(workspace.id, 'estilos/marca.css', ':root { --marca-color-primario: #123456 }');

      const result = await service.writeFile(workspace.id, 'estilos/marca.css', ':root { --marca-color-primario: #ff0000 }');

      expect(result.ok).toBe(false);
      const leido = await service.readFile(workspace.id, 'estilos/marca.css');
      expect(leido.ok && leido.data).toContain('#123456');
    });

    it('el modelo no puede sobrescribirla usando separadores de Windows', async () => {
      const workspace = await crearWorkspace();
      await service.writeSystemFile(workspace.id, 'estilos/marca.css', ':root {}');

      const result = await service.writeFile(workspace.id, 'estilos\\marca.css', ':root { suplantado: 1 }');

      expect(result.ok).toBe(false);
    });

    it('el modelo no puede editarla ni borrarla', async () => {
      const workspace = await crearWorkspace();
      await service.writeSystemFile(workspace.id, 'estilos/marca.css', ':root { --marca-color-primario: #123456 }');

      const editada = await service.editFile(workspace.id, 'estilos/marca.css', '#123456', '#ff0000');
      const borrada = await service.deleteFile(workspace.id, 'estilos/marca.css');

      expect(editada.ok).toBe(false);
      expect(borrada.ok).toBe(false);
      const leido = await service.readFile(workspace.id, 'estilos/marca.css');
      expect(leido.ok && leido.data).toContain('#123456');
    });
  });

  describe('eventos de progreso', () => {
    it('emite en curso y completado al escribir', async () => {
      const workspace = await crearWorkspace();

      await service.writeFile(workspace.id, 'index.html', '<!doctype html>');

      const deEsteArchivo = progreso.filter((event) => event.path === 'index.html');
      expect(deEsteArchivo.map((event) => event.status)).toEqual(['en_curso', 'completado']);
      expect(deEsteArchivo[1]?.bytes).toBeGreaterThan(0);
    });

    it('emite error con el archivo afectado cuando la operacion falla', async () => {
      const workspace = await crearWorkspace();

      await service.writeFile(workspace.id, 'script.js', 'alert(1)');

      const error = progreso.find((event) => event.status === 'error');
      expect(error?.path).toBe('script.js');
      expect(error?.message).toContain('.html');
    });
  });

  describe('lectura', () => {
    it('no sigue enlaces simbolicos al listar', async () => {
      const workspace = await crearWorkspace();
      await service.writeFile(workspace.id, 'index.html', '<!doctype html>');
      const externo = path.join(baseDir, 'externo.html');
      await fs.writeFile(externo, '<p>externo</p>', 'utf-8');
      try {
        await fs.symlink(externo, path.join(baseDir, 'presentaciones', workspace.id, 'enlace.html'));
      } catch {
        return;
      }

      const state = await service.getState(workspace.id);

      expect(state.ok && state.data.files.map((file) => file.path)).not.toContain('enlace.html');
    });

    it('rechaza leer una ruta fuera del workspace', async () => {
      const workspace = await crearWorkspace();

      const result = await service.readFile(workspace.id, '../workspaces.json');

      expect(result.ok).toBe(false);
    });
  });

  describe('imagenes', () => {
    // Las imagenes no estan en la allowlist de extensiones de la politica:
    // entran por una via propia, y por eso su nombre y su destino no los
    // decide el modelo.
    it('guarda la imagen en assets/ aunque la extension no este en la politica', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeImage(workspace.id, 'Fondo Portada.PNG', Buffer.from('imagen'));

      expect(result.ok && result.data.path).toBe('assets/fondo-portada.png');
      const guardado = await fs.readFile(
        path.join(baseDir, 'presentaciones', workspace.id, 'assets', 'fondo-portada.png'),
      );
      expect(guardado.toString()).toBe('imagen');
    });

    it('neutraliza la ruta del nombre propuesto en vez de escapar del workspace', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeImage(workspace.id, '../../evil.png', Buffer.from('x'));

      expect(result.ok && result.data.path).toBe('assets/evil.png');
      await expect(fs.stat(path.join(baseDir, 'evil.png'))).rejects.toThrow();
    });

    it('rechaza formatos que no son imagen', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeImage(workspace.id, 'payload.svg', Buffer.from('<svg onload=alert(1)>'));

      expect(result.ok).toBe(false);
    });

    it('rechaza una imagen vacia', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeImage(workspace.id, 'vacia.png', Buffer.alloc(0));

      expect(result.ok).toBe(false);
    });

    it('respeta el presupuesto total del workspace', async () => {
      const workspace = await crearWorkspace();

      const result = await service.writeImage(workspace.id, 'enorme.png', Buffer.alloc(5000));

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('limite');
    });

    it('no deja el archivo parcial si la escritura se completa', async () => {
      const workspace = await crearWorkspace();
      await service.writeImage(workspace.id, 'ok.png', Buffer.from('datos'));

      const assets = await fs.readdir(path.join(baseDir, 'presentaciones', workspace.id, 'assets'));

      expect(assets).toEqual(['ok.png']);
    });
  });

  describe('diagnostico de una edicion fallida', () => {
    // El mensaje generico producia reintentos a ciegas: el modelo volvia a
    // adivinar el fragmento y volvia a fallar, una y otra vez.
    const NL = String.fromCharCode(10);

    async function conIndex(contenido: string) {
      const workspace = await crearWorkspace();
      await service.writeFile(workspace.id, 'index.html', contenido);
      return workspace.id;
    }

    it('avisa cuando el fragmento existe pero con otro formato', async () => {
      const id = await conIndex(`<section>${NL}  <h1>Hola</h1>${NL}</section>`);

      const result = await service.editFile(id, 'index.html', '<section> <h1>Hola</h1> </section>', 'x');

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('otros espacios o saltos de linea');
    });

    it('devuelve el contenido real alrededor de la zona', async () => {
      const id = await conIndex(`<div class="uno">${NL}<p>alfa</p>${NL}<p>beta</p>${NL}</div>`);

      const result = await service.editFile(id, 'index.html', `<p>alfa</p>${NL}<p>GAMMA</p>`, 'x');

      expect(result.ok).toBe(false);
      // Ver el texto real es lo que permite corregir en vez de volver a probar.
      expect(result.ok === false && result.error).toContain('<p>beta</p>');
      expect(result.ok === false && result.error).toContain('Copia el texto tal cual');
    });

    it('manda releer cuando no hay ni rastro del fragmento', async () => {
      const id = await conIndex('<p>uno</p>');

      const result = await service.editFile(id, 'index.html', 'texto que no aparece por ningun lado', 'x');

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('workspace_read_file');
      expect(result.ok === false && result.error).toContain('no vuelvas a intentarlo adivinando');
    });

    it('dice en que lineas esta el fragmento ambiguo', async () => {
      const id = await conIndex(`<p>x</p>${NL}<span>y</span>${NL}<p>x</p>`);

      const result = await service.editFile(id, 'index.html', '<p>x</p>', 'z');

      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('lineas 1, 3');
    });
  });
});
