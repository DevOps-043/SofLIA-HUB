/**
 * Semilla del catalogo de Skills del sistema.
 *
 * El catalogo pasa a vivir en la base de datos, pero la version instalada
 * conserva su propia copia como respaldo. Si la semilla de la migracion y el
 * registro en codigo divergen, el respaldo deja de ser el que se sembro y el
 * usuario recibe una Skill distinta justo cuando falla la red: el peor momento
 * para una sorpresa.
 *
 * Por eso la semilla no se escribe a mano. Este script la GENERA desde
 * `src/shared/skills/registry.ts` y la inserta en la migracion entre marcas, o
 * COMPRUEBA que lo que hay en la migracion es lo que el codigo produce hoy.
 *
 * Uso:
 *   node scripts/quality/system-skills-seed.mjs --write   (regenerar)
 *   node scripts/quality/system-skills-seed.mjs           (comprobar)
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = process.cwd();
const MIGRACION = join(root, 'database', 'lia', 'migrations', 'system-skills-catalog.sql');
const INICIO = '-- <<< SEMILLA GENERADA';
const FIN = '-- SEMILLA GENERADA >>>';

/** Etiqueta de dollar-quoting: evita escapar comillas en un prompt de 20 KB. */
const TAG = '$semilla$';

async function cargarRegistro() {
  const exigir = createRequire(join(root, 'package.json'));
  const { rolldown } = await import(pathToFileURL(exigir.resolve('rolldown')).href);
  const temporal = mkdtempSync(join(tmpdir(), 'seed-skills-'));
  try {
    const entrada = join(temporal, 'entrada.ts');
    const origen = join(root, 'src', 'shared', 'skills', 'registry.ts').replace(/\\/g, '/');
    writeFileSync(entrada, `export { SYSTEM_SKILLS } from ${JSON.stringify(origen)};\n`);
    const bundle = await rolldown({ input: entrada, logLevel: 'silent' });
    const salida = join(temporal, 'registro.mjs');
    await bundle.write({ file: salida, format: 'esm' });
    const modulo = await import(pathToFileURL(salida).href);
    return modulo.SYSTEM_SKILLS;
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}

function citar(valor) {
  if (valor === null || valor === undefined) return 'NULL';
  const texto = String(valor);
  if (texto.includes(TAG)) {
    throw new Error(`El texto contiene la etiqueta de dollar-quoting ${TAG}; cambia la etiqueta.`);
  }
  return `${TAG}${texto}${TAG}`;
}

function citarJson(valor) {
  return `${citar(JSON.stringify(valor))}::jsonb`;
}

function citarArreglo(valores) {
  return `ARRAY[${valores.map((valor) => citar(valor)).join(', ')}]::text[]`;
}

function filaDe(skill, indice) {
  const workspace = skill.workspace
    ? {
      rootFolder: skill.workspace.rootFolder,
      allowedExtensions: [...skill.workspace.allowedExtensions],
      maxFileBytes: skill.workspace.maxFileBytes,
      maxWorkspaceBytes: skill.workspace.maxWorkspaceBytes,
      entryFile: skill.workspace.entryFile,
      protectedFiles: [...(skill.workspace.protectedFiles ?? [])],
    }
    : null;

  return [
    'INSERT INTO public.system_skills (',
    '  id, name, description, icon, command, category, surfaces, sort_order,',
    '  enabled, blocked_in_groups, starter_prompts, instructions, tools, workspace',
    ') VALUES (',
    `  ${citar(skill.id)},`,
    `  ${citar(skill.name)},`,
    `  ${citar(skill.description)},`,
    `  ${citar(skill.icon)},`,
    `  ${citar(skill.command ?? null)},`,
    `  ${citar(skill.category)},`,
    `  ${citarArreglo([...skill.surfaces])},`,
    `  ${(indice + 1) * 10},`,
    '  true,',
    `  ${skill.blockedInGroups === true},`,
    `  ${citarJson([...skill.starterPrompts])},`,
    `  ${citar(skill.instructions)},`,
    `  ${citarJson([...skill.tools])},`,
    `  ${workspace ? citarJson(workspace) : 'NULL'}`,
    ')',
    '-- Una reejecucion no pisa lo que un operador haya cambiado en produccion:',
    '-- administrar el catalogo sin publicar version es justo el objetivo.',
    'ON CONFLICT (id) DO NOTHING;',
  ].join('\n');
}

export async function generarSemilla() {
  const skills = await cargarRegistro();
  const bloques = skills.map((skill, indice) => filaDe(skill, indice));
  return `${INICIO}\n${bloques.join('\n\n')}\n${FIN}`;
}

function reemplazarBloque(contenido, bloque) {
  const desde = contenido.indexOf(INICIO);
  const hasta = contenido.indexOf(FIN);
  if (desde === -1 || hasta === -1 || hasta < desde) {
    throw new Error(`No se encontraron las marcas de semilla en ${MIGRACION}`);
  }
  return contenido.slice(0, desde) + bloque + contenido.slice(hasta + FIN.length);
}

function bloqueActual(contenido) {
  const desde = contenido.indexOf(INICIO);
  const hasta = contenido.indexOf(FIN);
  if (desde === -1 || hasta === -1 || hasta < desde) return null;
  return contenido.slice(desde, hasta + FIN.length);
}

const escribir = process.argv.includes('--write');
const contenido = readFileSync(MIGRACION, 'utf8');
const esperado = await generarSemilla();

if (escribir) {
  writeFileSync(MIGRACION, reemplazarBloque(contenido, esperado), 'utf8');
  console.log(`[system-skills-seed] Semilla regenerada en ${MIGRACION.slice(root.length + 1)}.`);
} else if (bloqueActual(contenido) !== esperado) {
  console.error(
    '::error::La semilla de database/lia/migrations/system-skills-catalog.sql no coincide con ' +
    'src/shared/skills/registry.ts. El respaldo en codigo y lo que se siembra en la base de datos ' +
    'divergirian. Regenera con: node scripts/quality/system-skills-seed.mjs --write',
  );
  process.exit(1);
} else {
  console.log('[system-skills-seed] OK: la semilla coincide con el registro en codigo.');
}
