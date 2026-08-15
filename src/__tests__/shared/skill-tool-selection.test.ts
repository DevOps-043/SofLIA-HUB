import { describe, expect, it } from 'vitest';
import {
  hasToolSelection,
  normalizeToolSelection,
  normalizeWebSearch,
  resolvePassiveToolSelection,
  resolveSkillTools,
  shouldSearchWeb,
} from '../../shared/skills/tool-selection';
import {
  SKILL_TOOL_ENTRIES,
  SKILL_TOOL_GROUPS,
  findSkillTool,
  groupOfSkillTool,
  isRegisteredSkillTool,
} from '../../shared/skills/tool-registry';
import { isToolAllowedFromSkill, isToolSelectableByUser } from '../../shared/skills/surface-tools';

const SUPERFICIE = ['gmail_get_messages', 'gmail_send', 'use_computer', 'read_browser_dom'];

describe('resolucion de la seleccion de herramientas', () => {
  it('sin seleccion NO retira nada', () => {
    expect(resolveSkillTools(SUPERFICIE, null).sort()).toEqual([...SUPERFICIE].sort());
    expect(resolveSkillTools(SUPERFICIE, undefined).sort()).toEqual([...SUPERFICIE].sort());
  });

  it('acota a lo elegido', () => {
    expect(resolveSkillTools(SUPERFICIE, ['gmail_get_messages'])).toEqual(['gmail_get_messages']);
  });

  it('NUNCA amplia: lo elegido que la superficie no ofrece no se concede', () => {
    // Es la invariante de la que depende que esta pantalla no sea una escalada
    // de privilegios: la superficie es el techo, siempre.
    expect(resolveSkillTools(['gmail_get_messages'], ['use_computer', 'execute_command']))
      .toEqual([]);
  });

  it('una lista vacia declarada SI retira todo (no es lo mismo que no elegir)', () => {
    expect(resolveSkillTools(SUPERFICIE, [])).toEqual([]);
    expect(hasToolSelection([])).toBe(true);
    expect(hasToolSelection(null)).toBe(false);
  });

  it('descarta identificadores desconocidos sin perder el resto', () => {
    expect(normalizeToolSelection(['gmail_get_messages', 'herramienta_del_futuro', '', 42 as any]))
      .toEqual(['gmail_get_messages']);
  });

  it('descarta lo que no es seleccionable por el usuario', () => {
    expect(normalizeToolSelection(['use_computer_on_node', 'whatsapp_send_file'])).toEqual([]);
  });

  it('no duplica', () => {
    expect(normalizeToolSelection(['gmail_send', 'gmail_send'])).toEqual(['gmail_send']);
  });
});

describe('herencia en las skills pasivas', () => {
  it('sin seleccion propia hereda la de la Skill', () => {
    expect(resolvePassiveToolSelection(null, ['gmail_get_messages'])).toEqual(['gmail_get_messages']);
  });

  it('la propia sustituye a la de la Skill', () => {
    expect(resolvePassiveToolSelection(['gmail_read_message'], ['gmail_get_messages']))
      .toEqual(['gmail_read_message']);
  });

  it('una rutina que acota a nada no hereda', () => {
    expect(resolvePassiveToolSelection([], ['gmail_get_messages'])).toEqual([]);
  });

  it('sin ninguna de las dos, no hay acotado', () => {
    expect(resolvePassiveToolSelection(null, null)).toBeNull();
  });
});

describe('busqueda web', () => {
  it('auto delega en la heuristica', () => {
    expect(shouldSearchWeb('auto', true)).toBe(true);
    expect(shouldSearchWeb('auto', false)).toBe(false);
  });

  it('siempre y nunca sustituyen a la heuristica', () => {
    expect(shouldSearchWeb('siempre', false)).toBe(true);
    expect(shouldSearchWeb('nunca', true)).toBe(false);
  });

  it('un valor desconocido cae en auto', () => {
    expect(normalizeWebSearch('quiza')).toBe('auto');
    expect(normalizeWebSearch(undefined)).toBe('auto');
  });
});

describe('registro de herramientas', () => {
  it('no repite una herramienta en dos grupos', () => {
    const nombres = SKILL_TOOL_ENTRIES.map((entry) => entry.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('toda entrada tiene etiqueta, descripcion y grupo', () => {
    for (const entry of SKILL_TOOL_ENTRIES) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.description.trim().length).toBeGreaterThan(0);
      expect(groupOfSkillTool(entry.name)).not.toBeNull();
    }
  });

  it('todo lo del registro es seleccionable por el usuario', () => {
    // Si no lo fuera, la pantalla ofreceria algo que el runtime descarta.
    for (const entry of SKILL_TOOL_ENTRIES) {
      expect(isToolSelectableByUser(entry.name)).toBe(true);
    }
  });

  it('las irreversibles estan marcadas', () => {
    for (const nombre of ['gmail_send', 'delete_item', 'execute_command', 'use_computer', 'gchat_send_message']) {
      expect(findSkillTool(nombre)?.irreversible).toBe(true);
    }
  });

  it('las de consulta NO estan marcadas como irreversibles', () => {
    for (const nombre of ['gmail_get_messages', 'drive_search', 'read_file', 'google_calendar_get_events']) {
      expect(findSkillTool(nombre)?.irreversible).toBeUndefined();
    }
  });

  it('los grupos no estan vacios', () => {
    for (const group of SKILL_TOOL_GROUPS) {
      expect(group.tools.length).toBeGreaterThan(0);
    }
  });
});

describe('las dos listas responden a preguntas distintas', () => {
  it('el usuario puede seleccionar lo que una fila del catalogo NO puede declarar', () => {
    for (const nombre of ['gmail_send', 'use_computer', 'execute_command', 'gchat_send_message']) {
      // La fila sigue sin poder concederselas...
      expect(isToolAllowedFromSkill('chat', nombre)).toBe(false);
      // ...y el usuario si puede elegirlas para su propia Skill.
      expect(isToolSelectableByUser(nombre)).toBe(true);
      expect(isRegisteredSkillTool(nombre)).toBe(true);
    }
  });

  it('ampliar lo seleccionable no relaja lo que declara una fila', () => {
    // Fija que este cambio no toco `NEVER_FROM_SKILLS`.
    for (const nombre of ['gmail_send', 'use_computer', 'delete_item', 'drive_upload']) {
      expect(isToolAllowedFromSkill('whatsapp', nombre)).toBe(false);
      expect(isToolAllowedFromSkill('telegram', nombre)).toBe(false);
    }
  });
});
