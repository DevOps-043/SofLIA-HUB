import { describe, expect, it, vi } from 'vitest';
import {
  clampWorkspacePolicy,
  mergeSystemSkills,
  sanitizeRootFolder,
  toSystemSkill,
  versionAlcanza,
} from '../../shared/skills/system-catalog';
import { PRESENTACIONES_SKILL } from '../../shared/skills/presentaciones-skill';
import type { SystemSkillRow } from '../../shared/skills/types';

/**
 * El catalogo del sistema pasa a vivir en la base de datos, y una fila declara
 * instrucciones, herramientas y politica de espacio de trabajo. Estas pruebas
 * fijan lo unico que hace segura esa decision: que de lo que una fila PIDE no
 * se siga lo que la aplicacion CONCEDE.
 */
describe('catalogo de skills del sistema', () => {
  function fila(extra: Partial<SystemSkillRow> = {}): SystemSkillRow {
    return {
      id: 'sistema:presentaciones',
      name: 'Presentaciones',
      instructions: 'Instrucciones de la skill.',
      surfaces: ['chat', 'whatsapp'],
      enabled: true,
      ...extra,
    };
  }

  describe('acotado de la politica de espacio de trabajo', () => {
    it('rechaza una raiz absoluta o con recorrido de directorios', () => {
      expect(sanitizeRootFolder('C:/Windows/System32', 'skills')).toBe('skills');
      expect(sanitizeRootFolder('../../.ssh', 'skills')).toBe('skills');
      expect(sanitizeRootFolder('/etc/passwd', 'skills')).toBe('skills');
      expect(sanitizeRootFolder('presentaciones/otra', 'skills')).toBe('skills');
      // La legitima pasa tal cual.
      expect(sanitizeRootFolder('presentaciones', 'skills')).toBe('presentaciones');
    });

    it('conserva solo las extensiones que el producto admite', () => {
      const politica = clampWorkspacePolicy({
        allowedExtensions: ['.html', '.exe', '.ps1', '.css', '.bat'],
      });

      expect(politica?.allowedExtensions).toEqual(['.html', '.css']);
    });

    it('cae a un conjunto util cuando no queda ninguna admitida', () => {
      const politica = clampWorkspacePolicy({ allowedExtensions: ['.exe', '.dll'] });

      expect(politica?.allowedExtensions).toEqual(['.html', '.css', '.md']);
    });

    it('topa los limites de tamano al maximo del producto', () => {
      const politica = clampWorkspacePolicy({
        maxFileBytes: 500 * 1024 * 1024,
        maxWorkspaceBytes: 900 * 1024 * 1024,
      });

      expect(politica?.maxFileBytes).toBe(2 * 1024 * 1024);
      expect(politica?.maxWorkspaceBytes).toBe(32 * 1024 * 1024);
    });

    it('respeta un limite mas restrictivo que el maximo', () => {
      const politica = clampWorkspacePolicy({ maxFileBytes: 1024 });

      expect(politica?.maxFileBytes).toBe(1024);
    });

    it('protege siempre la identidad, sin sembrar el runtime HTML heredado', () => {
      const politica = clampWorkspacePolicy({ protectedFiles: [] });

      expect(politica?.protectedFiles).toEqual(['estilos/marca.css']);
    });

    it('no admite un documento de entrada fuera del espacio de trabajo', () => {
      expect(clampWorkspacePolicy({ entryFile: '../../otro.html' })?.entryFile).toBe('index.html');
      expect(clampWorkspacePolicy({ entryFile: '/etc/passwd' })?.entryFile).toBe('index.html');
      expect(clampWorkspacePolicy({ entryFile: 'portada.html' })?.entryFile).toBe('portada.html');
    });

    it('una skill sin politica declarada es legitima', () => {
      expect(clampWorkspacePolicy(null)).toBeNull();
      expect(clampWorkspacePolicy('presentaciones')).toBeNull();
    });
  });

  describe('herramientas declaradas por una fila', () => {
    it('descarta las que ninguna skill puede aportar', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const skill = toSystemSkill(
        fila({ tools: ['workspace_write_file', 'use_computer', 'execute_command', 'delete_item'] }),
        'chat',
      );

      expect(skill?.tools).toEqual(['workspace_write_file']);
    });

    it('descarta nombres que no existen en el catalogo runtime', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const skill = toSystemSkill(fila({ tools: ['herramienta_inventada'] }), 'chat');

      expect(skill?.tools).toEqual([]);
    });

    it('un descarte no impide que la skill se ofrezca', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const skill = toSystemSkill(fila({ tools: ['use_computer'] }), 'chat');

      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('Presentaciones');
    });
  });

  describe('mapeo de la fila', () => {
    it('descarta una fila sin lo imprescindible', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(toSystemSkill(fila({ instructions: '   ' }), 'chat')).toBeNull();
      expect(toSystemSkill(fila({ name: '' }), 'chat')).toBeNull();
    });

    it('no ofrece la skill en una superficie que no declara', () => {
      expect(toSystemSkill(fila({ surfaces: ['chat'] }), 'whatsapp')).toBeNull();
      expect(toSystemSkill(fila({ surfaces: ['chat'] }), 'chat')).not.toBeNull();
    });

    it('la clase es del sistema por la fuente, nunca por un campo de la fila', () => {
      const skill = toSystemSkill({ ...fila(), skillClass: 'usuario' } as SystemSkillRow, 'chat');

      expect(skill?.skillClass).toBe('sistema');
    });

    it('ignora una categoria desconocida en vez de propagarla', () => {
      expect(toSystemSkill(fila({ category: 'inventada' }), 'chat')?.category).toBeNull();
      expect(toSystemSkill(fila({ category: 'documentos' }), 'chat')?.category).toBe('documentos');
    });
  });

  describe('fusion con la version instalada', () => {
    const code = [PRESENTACIONES_SKILL];

    it('una consulta fallida conserva las skills de la version', () => {
      const skills = mergeSystemSkills({ code, rows: null, surface: 'chat', appVersion: '0.9.6' });

      expect(skills.map((skill) => skill.id)).toEqual([PRESENTACIONES_SKILL.id]);
    });

    it('un catalogo vacio conserva las skills de la version', () => {
      const skills = mergeSystemSkills({ code, rows: [], surface: 'chat', appVersion: '0.9.6' });

      expect(skills.map((skill) => skill.id)).toEqual([PRESENTACIONES_SKILL.id]);
    });

    it('la fila manda sobre la version instalada', () => {
      const skills = mergeSystemSkills({
        code,
        rows: [fila({ name: 'Presentaciones ejecutivas' })],
        surface: 'chat',
        appVersion: '0.9.6',
      });

      expect(skills[0].name).toBe('Presentaciones ejecutivas');
    });

    it('una retirada declarada SI quita la skill', () => {
      const skills = mergeSystemSkills({
        code,
        rows: [fila({ enabled: false })],
        surface: 'chat',
        appVersion: '0.9.6',
      });

      expect(skills).toHaveLength(0);
    });

    it('una fila para una version posterior se ignora', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const skills = mergeSystemSkills({
        code,
        rows: [fila({ id: 'sistema:futura', name: 'Futura', min_app_version: '99.0.0' })],
        surface: 'chat',
        appVersion: '0.9.6',
      });

      expect(skills.map((skill) => skill.id)).toEqual([PRESENTACIONES_SKILL.id]);
    });

    it('una fila sin contraparte en el codigo se ofrece acotada', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const skills = mergeSystemSkills({
        code: [],
        rows: [fila({
          id: 'sistema:informes',
          name: 'Informes',
          tools: ['workspace_write_file', 'execute_command'],
          workspace: { rootFolder: '../fuera', maxFileBytes: 999 * 1024 * 1024 },
        })],
        surface: 'chat',
        appVersion: '0.9.6',
      });

      expect(skills).toHaveLength(1);
      expect(skills[0].tools).toEqual(['workspace_write_file']);
      expect(skills[0].workspace?.rootFolder).toBe('skills');
      expect(skills[0].workspace?.maxFileBytes).toBe(2 * 1024 * 1024);
    });

    it('una fila ilegible no retira lo que trae la version', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const skills = mergeSystemSkills({
        code,
        rows: [fila({ instructions: '' })],
        surface: 'chat',
        appVersion: '0.9.6',
      });

      expect(skills.map((skill) => skill.id)).toEqual([PRESENTACIONES_SKILL.id]);
    });

    it('ordena por el orden declarado', () => {
      const skills = mergeSystemSkills({
        code: [],
        rows: [
          fila({ id: 'sistema:b', name: 'B', sort_order: 20 }),
          fila({ id: 'sistema:a', name: 'A', sort_order: 10 }),
        ],
        surface: 'chat',
        appVersion: '0.9.6',
      });

      expect(skills.map((skill) => skill.id)).toEqual(['sistema:a', 'sistema:b']);
    });
  });

  describe('la semilla sobrevive al acotado', () => {
    /**
     * La fila que se siembra sale del registro en codigo. Si el acotado le
     * quitara algo, la Skill se comportaria distinto segun viniera de la base
     * de datos o del respaldo, y esa diferencia solo aparecerìa cuando falla
     * la red. Aqui se fija que el viaje de ida y vuelta no pierde nada.
     */
    it('la Skill de Presentaciones vuelve identica desde su fila', () => {
      const original = PRESENTACIONES_SKILL;
      const comoFila: SystemSkillRow = {
        id: original.id,
        name: original.name,
        description: original.description,
        icon: original.icon,
        command: original.command,
        category: original.category,
        surfaces: [...original.surfaces],
        enabled: true,
        blocked_in_groups: original.blockedInGroups,
        starter_prompts: [...original.starterPrompts],
        instructions: original.instructions,
        tools: [...original.tools],
        workspace: original.workspace,
      };

      const resuelta = toSystemSkill(comoFila, 'chat');

      expect(resuelta?.tools).toEqual([...original.tools]);
      expect(resuelta?.workspace?.rootFolder).toBe(original.workspace?.rootFolder);
      expect(resuelta?.workspace?.allowedExtensions).toEqual([...(original.workspace?.allowedExtensions ?? [])]);
      expect(resuelta?.workspace?.maxFileBytes).toBe(original.workspace?.maxFileBytes);
      expect(resuelta?.workspace?.maxWorkspaceBytes).toBe(original.workspace?.maxWorkspaceBytes);
      expect(resuelta?.workspace?.entryFile).toBe(original.workspace?.entryFile);
      expect(resuelta?.workspace?.protectedFiles).toEqual(
        expect.arrayContaining([...(original.workspace?.protectedFiles ?? [])]),
      );
      expect(resuelta?.command).toBe(original.command);
      expect(resuelta?.blockedInGroups).toBe(true);
      expect(resuelta?.instructions).toBe(original.instructions);
    });
  });

  it('una fila remota antigua no revierte el contrato React de Presentaciones', () => {
    const remota = fila({
      instructions: 'Genera index.html legado',
      workspace: { ...PRESENTACIONES_SKILL.workspace, entryFile: 'index.html', allowedExtensions: ['.html', '.css'] },
    });
    const [resuelta] = mergeSystemSkills({
      code: [PRESENTACIONES_SKILL],
      rows: [remota],
      surface: 'chat',
      appVersion: '0.9.6',
    });
    expect(resuelta.workspace?.entryFile).toBe('deck.json');
    expect(resuelta.instructions).toBe(PRESENTACIONES_SKILL.instructions);
  });

  describe('comparacion de versiones', () => {
    it('acepta cuando la instalada alcanza o supera', () => {
      expect(versionAlcanza('0.9.6', '0.9.6')).toBe(true);
      expect(versionAlcanza('1.0.0', '0.9.9')).toBe(true);
      expect(versionAlcanza('0.10.0', '0.9.9')).toBe(true);
    });

    it('rechaza cuando la instalada se queda corta', () => {
      expect(versionAlcanza('0.9.6', '0.9.7')).toBe(false);
      expect(versionAlcanza('0.9.6', '1.0.0')).toBe(false);
    });

    it('un valor ausente o ilegible no bloquea la fila', () => {
      expect(versionAlcanza('0.9.6', null)).toBe(true);
      expect(versionAlcanza('0.9.6', 'proxima')).toBe(true);
    });
  });
});
