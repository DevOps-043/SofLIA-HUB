import { beforeAll, describe, expect, it } from 'vitest';
import { buildModelTools } from '../../services/gemini-chat/model-config';
import {
  filterDeclarationsBySelection,
  resolveSkillToolNames,
} from '../../services/gemini-tools/turn-catalog';

// El catalogo de Google solo se declara si la superficie lo expone
// (`window.calendar`). Sin este puente, `buildModelTools` no incluiria Gmail y
// la prueba estaria midiendo otra cosa.
beforeAll(() => {
  (window as any).calendar = {};
  (window as any).integratedBrowser = {};
});

/** Nombres de todas las declaraciones que se enviarian al modelo. */
function nombresDelCatalogo(tools: any[]): string[] {
  return tools.flatMap((group) => (group.functionDeclarations ?? []).map((tool: any) => tool.name));
}

describe('la seleccion acota el catalogo que se envia al modelo', () => {
  it('sin Skill activa el catalogo queda igual que siempre', () => {
    const sinSkill = nombresDelCatalogo(buildModelTools(true, undefined, null));
    expect(sinSkill.length).toBeGreaterThan(20);
    expect(sinSkill).toContain('use_computer');
  });

  it('sin seleccion, una Skill activa no reduce nada', () => {
    const base = nombresDelCatalogo(buildModelTools(true, undefined, null));
    const conSkill = nombresDelCatalogo(buildModelTools(true, undefined, {
      id: 'sistema:correo',
      tools: [],
      workspaceId: null,
    }));
    expect(conSkill.sort()).toEqual(base.sort());
  });

  it('con seleccion, el catalogo se reduce a lo elegido', () => {
    const acotado = nombresDelCatalogo(buildModelTools(true, undefined, {
      id: 'sistema:correo',
      tools: [],
      workspaceId: null,
      allowedTools: ['gmail_get_messages', 'gmail_read_message'],
    }));

    expect(acotado.sort()).toEqual(['gmail_get_messages', 'gmail_read_message']);
    // Lo que importa: el modelo ya NO ve la computadora ni el navegador.
    expect(acotado).not.toContain('use_computer');
    expect(acotado).not.toContain('read_browser_dom');
  });

  it('no envia grupos vacios', () => {
    const tools = buildModelTools(true, undefined, {
      id: 'sistema:correo',
      tools: [],
      workspaceId: null,
      allowedTools: ['gmail_get_messages'],
    });
    // Un `functionDeclarations` vacio es una entrada invalida para el proveedor.
    for (const group of tools) {
      if ('functionDeclarations' in group) {
        expect(group.functionDeclarations.length).toBeGreaterThan(0);
      }
    }
  });

  it('una seleccion de algo que la superficie no ofrece deja el catalogo vacio, no lo amplia', () => {
    const acotado = nombresDelCatalogo(buildModelTools(false, undefined, {
      id: 'sistema:correo',
      tools: [],
      workspaceId: null,
      // `use_computer` no esta porque computerUseEnabled es false.
      allowedTools: ['use_computer'],
    }));
    expect(acotado).toEqual([]);
  });
});

describe('la seleccion acota tambien lo que aporta la Skill', () => {
  it('sin seleccion, la Skill aporta sus herramientas de workspace', () => {
    expect(resolveSkillToolNames({
      id: 'sistema:presentaciones',
      tools: ['workspace_write_file', 'workspace_read_file'],
      workspaceId: 'ws-1',
    })).toEqual(['workspace_write_file', 'workspace_read_file']);
  });

  it('si el usuario acoto a correo, el espacio de trabajo tampoco aparece', () => {
    expect(resolveSkillToolNames({
      id: 'sistema:presentaciones',
      tools: ['workspace_write_file'],
      workspaceId: 'ws-1',
      allowedTools: ['gmail_get_messages'],
    })).toEqual([]);
  });

  it('sin workspace vivo no se declaran, aunque esten seleccionadas', () => {
    expect(resolveSkillToolNames({
      id: 'sistema:presentaciones',
      tools: ['workspace_write_file'],
      workspaceId: null,
      allowedTools: ['workspace_write_file'],
    })).toEqual([]);
  });
});

describe('filtrado de declaraciones', () => {
  const declaraciones = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];

  it('sin seleccion devuelve todas', () => {
    expect(filterDeclarationsBySelection(declaraciones, null)).toHaveLength(3);
  });

  it('con seleccion devuelve solo las conocidas y elegidas', () => {
    // 'a' no esta en el registro, asi que se descarta al normalizar.
    expect(filterDeclarationsBySelection(declaraciones, ['a'])).toEqual([]);
  });
});
