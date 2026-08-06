#!/usr/bin/env node
/**
 * Compuerta de cadena de suministro.
 *
 * Verifica que el arbol resuelto no contenga versiones publicadas con codigo
 * malicioso en incidentes conocidos, y que ninguna dependencia haya introducido
 * un gancho de instalacion nuevo sin revisar. El registro de npm ya retiro las
 * versiones de ChainDrop, pero un lockfile antiguo, una cache local o un espejo
 * interno todavia pueden servirlas: la comprobacion es barata y no depende de
 * que el registro siga limpio.
 *
 * Fuente del incidente: ChainDrop, divulgado el 4 de agosto de 2026.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Versiones exactas con carga maliciosa confirmada. Solo se listan pares
 * `nombre@version` verificados: un rango amplio bloquearia versiones sanas.
 */
const COMPROMISED_VERSIONS = new Map([
  ['keyv', ['6.0.0']],
  ['flat-cache', ['6.1.24']],
  ['file-entry-cache', ['11.1.6']],
  ['cacheable-request', ['13.0.20']],
  ['cacheable', ['2.5.1']],
  ['cache-manager', ['7.2.10']],
  ['@cacheable/utils', ['2.5.1']],
  ['@cacheable/memory', ['2.2.1']],
  ['@cacheable/node-cache', ['3.1.2']],
  ['@cacheable/net', ['2.1.1']],
  ['ecto', ['5.0.1']],
]);

/**
 * Paquetes que legitimamente ejecutan un script de instalacion en este arbol,
 * con el motivo por el que se aceptan. Cualquier gancho fuera de esta lista
 * detiene la compuerta para que una persona lo revise antes de instalarlo.
 */
const REVIEWED_INSTALL_HOOKS = new Map([
  ['@google/genai', 'preinstall sin efecto (echo)'],
  ['@whiskeysockets/baileys', 'preinstall que solo valida la version de Node'],
  ['sharp', 'descarga del binario de libvips'],
  ['onnxruntime-node', 'descarga del runtime nativo'],
  ['electron', 'descarga del binario de Electron'],
  ['esbuild', 'descarga del binario de esbuild'],
  ['msw', 'copia del service worker'],
  ['playwright-core', 'descarga de navegadores'],
  ['protobufjs', 'generacion de tipos'],
  ['@nut-tree-fork/nut-js', 'modulo nativo de automatizacion'],
  ['@fission-ai/openspec', 'postinstall que solo imprime una sugerencia; sin red'],
  ['electron-winstaller', 'copia el 7-Zip local correspondiente a la arquitectura'],
  ['ffi-napi', 'node-gyp-build: carga el binario precompilado'],
  ['ref-napi', 'node-gyp-build: carga el binario precompilado'],
  ['fsevents', 'modulo nativo opcional de macOS'],
  ['iconv', 'modulo nativo de codificaciones'],
  ['tesseract.js', 'postinstall de aviso de financiacion (opencollective)'],
  ['active-win', 'node-pre-gyp: binario nativo de la ventana activa'],
]);

const problems = [];

const lockPath = join(root, 'package-lock.json');
if (!existsSync(lockPath)) {
  console.error('No se encontro package-lock.json: la cadena de suministro no es verificable.');
  process.exit(1);
}
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));

for (const [entryPath, info] of Object.entries(lock.packages ?? {})) {
  if (!entryPath) continue;
  const name = info.name ?? entryPath.split('node_modules/').pop();
  const blocked = COMPROMISED_VERSIONS.get(name);
  if (blocked && blocked.includes(info.version)) {
    problems.push(`Version comprometida en el arbol: ${name}@${info.version} (${entryPath})`);
  }
  if (info.hasInstallScript && !REVIEWED_INSTALL_HOOKS.has(name)) {
    problems.push(`Gancho de instalacion sin revisar: ${name} (${entryPath}). Revisa su contenido y registralo en REVIEWED_INSTALL_HOOKS si es legitimo.`);
  }
}

if (problems.length > 0) {
  console.error('Verificacion de cadena de suministro fallida:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

const reviewed = [...REVIEWED_INSTALL_HOOKS.keys()].length;
const blockedVersions = [...COMPROMISED_VERSIONS.values()].reduce((total, list) => total + list.length, 0);
console.log(`Cadena de suministro verificada: ${blockedVersions} versiones vetadas ausentes y ${reviewed} ganchos de instalacion revisados.`);
