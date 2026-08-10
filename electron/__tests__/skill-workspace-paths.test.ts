import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasAllowedExtension,
  isContained,
  normalizeRelativePath,
  resolveInsideWorkspace,
} from '../skill-workspace/paths';

/**
 * La contencion de rutas es la barrera que impide que una skill escriba
 * fuera de su espacio de trabajo. Se prueba contra el sistema de archivos
 * real porque el caso critico (enlace simbolico hacia fuera) no se reproduce
 * con rutas simuladas.
 */
describe('contencion de rutas del workspace de una skill', () => {
  let base: string;
  let workspace: string;
  let exterior: string;

  beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-ws-'));
    workspace = path.join(base, 'workspace');
    exterior = path.join(base, 'exterior');
    await fs.mkdir(path.join(workspace, 'estilos'), { recursive: true });
    await fs.mkdir(exterior, { recursive: true });
    await fs.writeFile(path.join(workspace, 'index.html'), '<!doctype html>', 'utf-8');
    await fs.writeFile(path.join(exterior, 'secreto.txt'), 'contenido privado', 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(base, { recursive: true, force: true });
  });

  it('acepta una ruta relativa dentro del workspace', async () => {
    const result = await resolveInsideWorkspace(workspace, 'estilos/presentacion.css');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.relativePath).toBe('estilos/presentacion.css');
      expect(isContained(workspace, result.absolutePath)).toBe(true);
    }
  });

  it('rechaza una ruta que sale con segmentos superiores', async () => {
    const result = await resolveInsideWorkspace(workspace, '../exterior/secreto.txt');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('segmento_superior');
  });

  it('rechaza segmentos superiores incrustados en medio de la ruta', async () => {
    const result = await resolveInsideWorkspace(workspace, 'estilos/../../exterior/secreto.txt');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('segmento_superior');
  });

  it('rechaza una ruta absoluta externa', async () => {
    const result = await resolveInsideWorkspace(workspace, path.join(exterior, 'secreto.txt'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('absoluta');
  });

  it('rechaza un enlace simbolico que apunta fuera del workspace', async () => {
    const enlace = path.join(workspace, 'fuga.html');
    try {
      await fs.symlink(path.join(exterior, 'secreto.txt'), enlace);
    } catch {
      // Windows sin modo desarrollador no permite crear enlaces; en ese caso
      // la comprobacion no aplica y el resto de barreras sigue cubierta.
      return;
    }

    const result = await resolveInsideWorkspace(workspace, 'fuga.html');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('enlace_externo');
  });

  it('rechaza escribir dentro de una carpeta enlazada hacia fuera', async () => {
    const carpetaEnlazada = path.join(workspace, 'salida');
    try {
      await fs.symlink(exterior, carpetaEnlazada, 'dir');
    } catch {
      return;
    }

    const result = await resolveInsideWorkspace(workspace, 'salida/nuevo.html');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('enlace_externo');
  });

  it('rechaza una ruta hermana cuyo nombre comparte prefijo con la raiz', async () => {
    const hermano = `${workspace}-otro`;
    await fs.mkdir(hermano, { recursive: true });

    expect(isContained(workspace, path.join(hermano, 'archivo.html'))).toBe(false);
  });

  it('permite escribir un archivo que aun no existe', async () => {
    const result = await resolveInsideWorkspace(workspace, 'estilos/presentacion.css', { mustExist: false });

    expect(result.ok).toBe(true);
  });

  it('rechaza leer un archivo inexistente cuando se exige que exista', async () => {
    const result = await resolveInsideWorkspace(workspace, 'no-existe.html', { mustExist: true });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('fuera_del_workspace');
  });
});

describe('normalizacion de rutas relativas', () => {
  it('acepta separadores de Windows y los unifica', () => {
    const result = normalizeRelativePath('estilos\\presentacion.css');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.relativePath).toBe('estilos/presentacion.css');
  });

  it('rechaza una ruta con unidad de Windows', () => {
    const result = normalizeRelativePath('C:\\Users\\publico\\archivo.html');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('absoluta');
  });

  it('rechaza una ruta UNC', () => {
    const result = normalizeRelativePath('//servidor/compartido/archivo.html');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('absoluta');
  });

  it('rechaza una ruta vacia', () => {
    expect(normalizeRelativePath('   ').ok).toBe(false);
  });
});

describe('allowlist de extensiones', () => {
  const permitidas = ['.html', '.css', '.md'];

  it('acepta una extension declarada', () => {
    expect(hasAllowedExtension('estilos/presentacion.css', permitidas)).toBe(true);
  });

  it('acepta sin distinguir mayusculas', () => {
    expect(hasAllowedExtension('INDEX.HTML', permitidas)).toBe(true);
  });

  it('rechaza una extension no declarada', () => {
    expect(hasAllowedExtension('script.js', permitidas)).toBe(false);
  });

  it('rechaza un archivo sin extension', () => {
    expect(hasAllowedExtension('LEEME', permitidas)).toBe(false);
  });
});
