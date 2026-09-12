import { existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type RollupWarning = { code?: string; message: string };
type WarningHandler = (warning: RollupWarning) => void;

const COMMONJS_NATIVE_OPTIONALS = ['bufferutil', 'utf-8-validate'];

/**
 * Paquetes que si deben empaquetarse en el bundle del proceso principal, en
 * lugar de resolverse desde `node_modules` en tiempo de ejecucion.
 */
const BUNDLED_PACKAGES = new Set(['@whiskeysockets/baileys']);

/**
 * El proceso principal solo empaqueta codigo propio: `node_modules` viaja con
 * la aplicacion y Node resuelve esos paquetes al arrancar. Enumerar solo las
 * dependencias directas dejaba fuera a las transitivas, y Rolldown —el
 * empaquetador de Vite 8— convierte en error lo que Rollup dejaba en aviso:
 * cualquier `require` opcional que una dependencia haga a un modulo no
 * instalado (`chromium-bidi` en Playwright, `mock-aws-s3` en node-pre-gyp)
 * abortaba la compilacion.
 */
export function createElectronExternals(dependencies: Record<string, string> = {}): (id: string) => boolean {
  const builtins = new Set([
    ...builtinModules,
    ...builtinModules.map((moduleName) => `node:${moduleName}`),
    ...COMMONJS_NATIVE_OPTIONALS,
  ]);
  const directDependencies = new Set(Object.keys(dependencies));
  const nodeModulesRoots = collectNodeModulesRoots(fileURLToPath(new URL('.', import.meta.url)));

  return (id: string): boolean => {
    if (builtins.has(id) || id.startsWith('node:')) return true;
    // Rutas relativas o absolutas son codigo del propio proyecto.
    if (id.startsWith('.') || id.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(id)) return false;

    const packageName = resolvePackageName(id);
    if (BUNDLED_PACKAGES.has(packageName)) return false;
    // Las dependencias declaradas viajan en `node_modules` junto a la app.
    if (directDependencies.has(packageName)) return true;
    // Una transitiva se empaqueta con quien la usa: dejarla como `require`
    // externo rompe a las que solo publican punto de entrada ESM. Solo se
    // externaliza la que ni siquiera esta instalada, que es un `require`
    // opcional que el empaquetador no debe intentar resolver.
    return !isPackageInstalled(packageName, nodeModulesRoots);
  };
}

/**
 * Directorios `node_modules` que Node consultaria al resolver desde este
 * archivo, del mas cercano al mas lejano. Un worktree de Git tiene su propio
 * `node_modules` vacio y hereda la instalacion real del checkout principal:
 * mirar solo la raiz del proyecto daba por no instalada a cualquier transitiva
 * y la externalizaba, emitiendo un `require` de un paquete que solo publica
 * ESM (`whatsapp-rust-bridge`, via Baileys) y abortando el arranque.
 */
function collectNodeModulesRoots(startDirectory: string): string[] {
  const roots: string[] = [];
  let current = startDirectory;

  while (true) {
    roots.push(join(current, 'node_modules'));
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return roots;
}

function isPackageInstalled(packageName: string, nodeModulesRoots: readonly string[]): boolean {
  const segments = packageName.split('/');
  return nodeModulesRoots.some((root) => existsSync(join(root, ...segments)));
}

/** Nombre del paquete de un especificador, respetando el ambito `@scope/name`. */
function resolvePackageName(id: string): string {
  const segments = id.split('/');
  return id.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

export function onElectronRollupWarning(warning: RollupWarning, warn: WarningHandler): void {
  if (isIgnorableRollupWarning(warning)) return;
  warn(warning);
}

function isIgnorableRollupWarning(warning: RollupWarning): boolean {
  if (
    warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
    warning.message.includes('"WriteStream" is imported from external module "fs" but never used')
  ) {
    return true;
  }

  if (
    warning.code === 'EVAL' &&
    warning.message.includes('Use of eval in "node_modules/@protobufjs/inquire/index.js"')
  ) {
    return true;
  }

  return false;
}
