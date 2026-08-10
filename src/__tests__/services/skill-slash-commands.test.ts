import { describe, expect, it } from 'vitest';
import {
  buildSkillCommands,
  parseSlashInput,
  toSkillCommand,
} from '../../services/skills/slash-commands';
import type { SkillCatalog } from '../../services/skills/catalog';
import { PRESENTACIONES_SKILL } from '../../shared/skills/presentaciones-skill';
import type { UserSkill } from '../../shared/skills/types';

// Se usa la Skill REAL, no una copia: si alguien cambia su comando declarado,
// estas pruebas deben notarlo en vez de seguir pasando contra un doble.
const PRESENTACIONES = PRESENTACIONES_SKILL;

function userSkill(name: string, id = name): UserSkill {
  return {
    skillClass: 'usuario',
    id,
    userId: 'user-1',
    command: null,
    name,
    description: null,
    icon: '📝',
    category: null,
    instructions: 'x',
    starterPrompts: [],
    isFavorite: false,
    usageCount: 0,
    createdAt: '',
    updatedAt: '',
  };
}

function catalogo(user: UserSkill[] = []): SkillCatalog {
  const system = [PRESENTACIONES];
  return { system, user, all: [...system, ...user] };
}

describe('derivacion del comando desde el nombre', () => {
  it('quita acentos y usa minusculas', () => {
    expect(toSkillCommand('Presentación')).toBe('presentacion');
  });

  it('convierte espacios y signos en guiones', () => {
    expect(toSkillCommand('Resumen ejecutivo (v2)')).toBe('resumen-ejecutivo-v2');
  });

  it('no deja guiones sueltos en los extremos', () => {
    expect(toSkillCommand('  ¡Informe!  ')).toBe('informe');
  });

  it('devuelve vacio cuando el nombre no aporta caracteres validos', () => {
    expect(toSkillCommand('***')).toBe('');
  });
});

describe('catalogo de comandos', () => {
  it('incluye skills del sistema y del usuario', () => {
    const commands = buildSkillCommands(catalogo([userSkill('Resumen ejecutivo')]));

    expect(commands.map((entry) => entry.command)).toEqual(['presentacion', 'resumen-ejecutivo']);
  });

  it('ante un comando duplicado gana la del sistema', () => {
    const commands = buildSkillCommands(catalogo([userSkill('Presentaciones', 'user-dup')]));

    const presentacion = commands.filter((entry) => entry.command === 'presentacion');
    expect(presentacion).toHaveLength(1);
    expect(presentacion[0].skill.id).toBe('sistema:presentaciones');
  });

  it('descarta skills cuyo nombre no produce comando', () => {
    const commands = buildSkillCommands(catalogo([userSkill('***', 'user-raro')]));

    expect(commands.map((entry) => entry.command)).not.toContain('');
  });
});

describe('interpretacion del compositor', () => {
  const commands = buildSkillCommands(catalogo([userSkill('Resumen ejecutivo')]));

  it('no activa nada si el texto no empieza por barra', () => {
    expect(parseSlashInput('hola', commands)).toBeNull();
    expect(parseSlashInput('quiero /presentacion', commands)).toBeNull();
  });

  it('deja de ser comando en cuanto hay un espacio', () => {
    // "/presentacion para Acme" es un mensaje con contexto, no un comando.
    expect(parseSlashInput('/presentacion para Acme', commands)).toBeNull();
  });

  it('con la barra sola ofrece todo el catalogo', () => {
    const query = parseSlashInput('/', commands);

    expect(query?.matches.map((entry) => entry.command)).toEqual(['presentacion', 'resumen-ejecutivo']);
    expect(query?.exact).toBeNull();
  });

  it('filtra por prefijo mientras se escribe', () => {
    const query = parseSlashInput('/pres', commands);

    expect(query?.matches).toHaveLength(1);
    expect(query?.matches[0].command).toBe('presentacion');
  });

  it('reconoce el comando completo como coincidencia exacta', () => {
    const query = parseSlashInput('/presentacion', commands);

    expect(query?.exact?.skill.id).toBe('sistema:presentaciones');
  });

  it('acepta el comando escrito con acento', () => {
    const query = parseSlashInput('/presentación', commands);

    expect(query?.exact?.skill.id).toBe('sistema:presentaciones');
  });

  it('prioriza el prefijo sobre la coincidencia interna', () => {
    const conInterna = buildSkillCommands(catalogo([userSkill('Mi presentacion semanal')]));
    const query = parseSlashInput('/presentacion', conInterna);

    expect(query?.matches[0].command).toBe('presentacion');
  });

  it('no ofrece nada cuando el texto no coincide con ninguna skill', () => {
    const query = parseSlashInput('/inexistente', commands);

    expect(query?.matches).toHaveLength(0);
    expect(query?.exact).toBeNull();
  });
});
