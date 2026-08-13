import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESENTACIONES_SKILL_ID } from '../../shared/skills/presentaciones-skill';
import type { SystemSkillRow } from '../../shared/skills/types';
import type { UserSkill } from '../../shared/skills/types';

/**
 * El catalogo del sistema se resuelve desde `public.system_skills`, y el
 * registro en codigo pasa a ser el respaldo. Estas pruebas fijan las dos
 * propiedades de las que depende que el usuario no se quede sin Skills:
 * un fallo de lectura conserva las de su version, y solo una retirada
 * declarada las quita.
 */

const filas = vi.hoisted(() => ({ valor: null as SystemSkillRow[] | null }));
const skillsDelUsuario = vi.hoisted(() => ({ valor: [] as UserSkill[] }));

vi.mock('../../services/skills/system-skills-store', () => ({
  loadSystemSkillRows: () => Promise.resolve(filas.valor),
  resetSystemSkillsCache: () => {},
}));

vi.mock('../../services/skills/user-skills-store', () => ({
  listUserSkills: () => Promise.resolve(skillsDelUsuario.valor),
}));

const { resolveSkillCatalog } = await import('../../services/skills/catalog');

function fila(extra: Partial<SystemSkillRow> = {}): SystemSkillRow {
  return {
    id: PRESENTACIONES_SKILL_ID,
    name: 'Presentaciones',
    instructions: 'Instrucciones de la skill.',
    surfaces: ['chat', 'whatsapp'],
    enabled: true,
    ...extra,
  };
}

function skillDeUsuario(extra: Partial<UserSkill> = {}): UserSkill {
  return {
    skillClass: 'usuario',
    id: 'a5d3f1c0-0000-4000-8000-000000000001',
    userId: 'usuario-1',
    name: 'Mi resumen',
    description: null,
    icon: 'herramienta',
    command: null,
    category: null,
    instructions: 'Resume en tres lineas.',
    starterPrompts: [],
    isFavorite: false,
    usageCount: 0,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    ...extra,
  } as UserSkill;
}

describe('catalogo de skills con origen remoto', () => {
  beforeEach(() => {
    filas.valor = null;
    skillsDelUsuario.valor = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resuelve las skills del sistema desde las filas', async () => {
    filas.valor = [fila({ name: 'Presentaciones ejecutivas' })];

    const catalogo = await resolveSkillCatalog('chat');

    expect(catalogo.system.map((skill) => skill.name)).toEqual(['Presentaciones ejecutivas']);
  });

  it('un fallo de lectura conserva las skills de la version instalada', async () => {
    filas.valor = null;

    const catalogo = await resolveSkillCatalog('chat');

    expect(catalogo.system.map((skill) => skill.id)).toContain(PRESENTACIONES_SKILL_ID);
  });

  it('un catalogo vacio tampoco retira nada', async () => {
    filas.valor = [];

    const catalogo = await resolveSkillCatalog('chat');

    expect(catalogo.system.map((skill) => skill.id)).toContain(PRESENTACIONES_SKILL_ID);
  });

  it('una fila deshabilitada SI retira la skill', async () => {
    filas.valor = [fila({ enabled: false })];

    const catalogo = await resolveSkillCatalog('chat');

    expect(catalogo.system).toHaveLength(0);
  });

  it('una fila sin contraparte en codigo se ofrece acotada', async () => {
    filas.valor = [
      fila({
        id: 'sistema:informes',
        name: 'Informes',
        tools: ['workspace_write_file', 'execute_command'],
        workspace: { rootFolder: '../../fuera', maxFileBytes: 999 * 1024 * 1024 },
      }),
    ];

    const catalogo = await resolveSkillCatalog('chat');
    const informes = catalogo.system.find((skill) => skill.id === 'sistema:informes');

    expect(informes?.tools).toEqual(['workspace_write_file']);
    expect(informes?.workspace?.rootFolder).toBe('skills');
    expect(informes?.workspace?.maxFileBytes).toBe(2 * 1024 * 1024);
  });

  describe('guardas de identidad', () => {
    it('una skill de usuario con identificador reservado se descarta', async () => {
      skillsDelUsuario.valor = [skillDeUsuario({ id: PRESENTACIONES_SKILL_ID, name: 'Suplantadora' })];

      const catalogo = await resolveSkillCatalog('chat');

      expect(catalogo.user).toHaveLength(0);
      expect(catalogo.all.some((skill) => skill.name === 'Suplantadora')).toBe(false);
    });

    it('una skill de usuario nunca se presenta como del sistema', async () => {
      skillsDelUsuario.valor = [skillDeUsuario()];

      const catalogo = await resolveSkillCatalog('chat');

      expect(catalogo.user.every((skill) => skill.skillClass === 'usuario')).toBe(true);
      expect(catalogo.system.every((skill) => skill.skillClass === 'sistema')).toBe(true);
    });

    it('un comando en conflicto resuelve a la skill del sistema', async () => {
      // Las del sistema van primero en el catalogo, y `buildSkillCommands`
      // se queda con la primera que produce cada comando.
      filas.valor = [fila({ command: 'presentacion' })];
      skillsDelUsuario.valor = [skillDeUsuario({ name: 'Presentacion', command: 'presentacion' })];

      const catalogo = await resolveSkillCatalog('chat');
      const { buildSkillCommands } = await import('../../services/skills/slash-commands');
      const comandos = buildSkillCommands(catalogo);
      const encontrado = comandos.find((entrada) => entrada.command === 'presentacion');

      expect(encontrado?.skill.skillClass).toBe('sistema');
    });
  });
});
