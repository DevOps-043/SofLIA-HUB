import { describe, expect, it, vi } from 'vitest';
import {
  catalogChannelsForSkill,
  isSkillActiveOnChannel,
  normalizeChannels,
  resolveChannelsForSkill,
  skillsActiveOnSurface,
} from '../../shared/skills/channels';
import { filterSkillTools, isToolAllowedFromSkill } from '../../shared/skills/surface-tools';
import { readSystemSkillRow } from '../../shared/skills/system-catalog';
import type { Skill, SystemSkill, SystemSkillRow } from '../../shared/skills/types';

function systemSkill(overrides: Partial<SystemSkill> = {}): SystemSkill {
  return {
    skillClass: 'sistema',
    id: 'sistema:prueba',
    name: 'Prueba',
    description: null,
    icon: 'herramienta',
    category: null,
    instructions: 'Instrucciones.',
    starterPrompts: [],
    surfaces: ['chat', 'whatsapp', 'telegram'],
    tools: [],
    workspace: null,
    ...overrides,
  };
}

describe('canales de una Skill', () => {
  it('deriva los canales del catalogo, con escritorio en lugar de chat', () => {
    expect(catalogChannelsForSkill(systemSkill()).sort())
      .toEqual(['escritorio', 'telegram', 'whatsapp']);
  });

  it('una Skill del usuario solo vive en su computadora', () => {
    const skill = {
      skillClass: 'usuario', id: 'u1', name: 'Mia', description: null, icon: 'herramienta',
      category: null, instructions: 'x', starterPrompts: [], userId: 'user-1', command: null,
      isFavorite: false, usageCount: 0, createdAt: '', updatedAt: '',
    } as Skill;
    expect(catalogChannelsForSkill(skill)).toEqual(['escritorio']);
  });

  it('sin eleccion del usuario resuelve a todos los canales del catalogo', () => {
    const skill = systemSkill();
    expect(resolveChannelsForSkill(skill, null).sort()).toEqual(['escritorio', 'telegram', 'whatsapp']);
    expect(resolveChannelsForSkill(skill, undefined).sort()).toEqual(['escritorio', 'telegram', 'whatsapp']);
    expect(resolveChannelsForSkill(skill, {}).sort()).toEqual(['escritorio', 'telegram', 'whatsapp']);
  });

  it('la eleccion del usuario acota lo declarado', () => {
    const skill = systemSkill();
    expect(resolveChannelsForSkill(skill, { 'sistema:prueba': ['whatsapp'] })).toEqual(['whatsapp']);
  });

  it('la eleccion NUNCA amplia lo que el catalogo declara', () => {
    // La Skill no declara Telegram: pedirlo no la hace disponible alli.
    const skill = systemSkill({ surfaces: ['chat'] });
    expect(resolveChannelsForSkill(skill, { 'sistema:prueba': ['telegram', 'whatsapp', 'escritorio'] }))
      .toEqual(['escritorio']);
  });

  it('una lista vacia declarada SI retira todos los canales', () => {
    const skill = systemSkill();
    expect(resolveChannelsForSkill(skill, { 'sistema:prueba': [] })).toEqual([]);
    expect(isSkillActiveOnChannel(skill, 'whatsapp', { 'sistema:prueba': [] })).toBe(false);
  });

  it('acota una lista de Skills por superficie', () => {
    const correo = systemSkill({ id: 'sistema:correo' });
    const agenda = systemSkill({ id: 'sistema:agenda' });
    const activas = skillsActiveOnSurface([correo, agenda], 'whatsapp', {
      'sistema:agenda': ['escritorio'],
    });
    expect(activas.map((skill) => skill.id)).toEqual(['sistema:correo']);
  });

  it('descarta canales que esta version no conoce', () => {
    expect(normalizeChannels(['whatsapp', 'sms', 42, null])).toEqual(['whatsapp']);
    expect(normalizeChannels('whatsapp')).toEqual([]);
  });
});

describe('herramientas concedibles desde una fila del catalogo', () => {
  it('no concede envio de correo ni control del equipo en ninguna superficie', () => {
    for (const surface of ['chat', 'whatsapp', 'telegram'] as const) {
      for (const tool of ['gmail_send', 'use_computer', 'execute_command', 'delete_item']) {
        expect(isToolAllowedFromSkill(surface, tool)).toBe(false);
      }
    }
  });

  it('no concede escritura sobre buzon, calendario, Drive ni espacios de Chat', () => {
    const escritura = [
      'gchat_send_message', 'gmail_trash', 'gmail_modify_labels', 'gmail_create_label',
      'gmail_delete_label', 'gmail_batch_empty_label', 'gmail_empty_all_labels',
      'gmail_apply_organization_plan', 'gmail_undo_organization_plan',
      'drive_upload', 'drive_create_folder', 'google_calendar_create', 'google_calendar_delete',
    ];
    for (const tool of escritura) {
      expect(isToolAllowedFromSkill('whatsapp', tool)).toBe(false);
    }
  });

  it('descarta lo no concedible y conserva lo permitido, sin fallar', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const concedidas = filterSkillTools('telegram', [
      'workspace_read_file', 'gmail_send', 'drive_upload', 'workspace_write_file',
    ]);
    expect(concedidas).toEqual(['workspace_read_file', 'workspace_write_file']);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});

describe('lectura de una fila del catalogo por superficie', () => {
  const fila: SystemSkillRow = {
    id: 'sistema:correo',
    name: 'Correo',
    instructions: 'Revisa la bandeja.',
    surfaces: ['whatsapp', 'telegram'],
  };

  it('resuelve una fila declarada para Telegram', () => {
    const lectura = readSystemSkillRow(fila, 'telegram');
    expect(lectura.estado).toBe('ok');
  });

  it('retira la Skill de una superficie que la fila no declara', () => {
    expect(readSystemSkillRow(fila, 'chat').estado).toBe('otra-superficie');
  });
});
