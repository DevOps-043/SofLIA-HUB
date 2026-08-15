import { describe, expect, it } from 'vitest';
import { SKILL_TOOL_ENTRIES } from '../../shared/skills/tool-registry';
import { COMPUTER_USE_TOOLS } from '../../services/gemini-tools/computer-tools';
import { GOOGLE_WORKSPACE_TOOLS } from '../../services/gemini-tools/google-workspace-tools';
import { INTEGRATED_BROWSER_TOOLS } from '../../services/gemini-tools/integrated-browser-tools';
import { NATIVE_AI_TOOLS } from '../../services/gemini-tools/native-tools';
import { PROJECT_HUB_TOOLS } from '../../services/gemini-tools/project-hub-tools';
import { SKILL_WORKSPACE_TOOLS } from '../../services/gemini-tools/skill-workspace-tools';

/**
 * El registro es lo que ve el usuario; el catalogo runtime es lo que existe.
 * Si divergen, la pantalla ofrece herramientas que nunca se conceden —o deja
 * fuera capacidades reales— y el usuario configura sobre una ficcion.
 *
 * Esta prueba es la que caza una errata en un identificador: un nombre mal
 * escrito no falla en ninguna otra parte, simplemente se descarta en silencio
 * al intersecar.
 */
const CATALOGO_DEL_CHAT = new Set(
  [
    COMPUTER_USE_TOOLS,
    GOOGLE_WORKSPACE_TOOLS,
    INTEGRATED_BROWSER_TOOLS,
    NATIVE_AI_TOOLS,
    PROJECT_HUB_TOOLS,
    SKILL_WORKSPACE_TOOLS,
  ].flatMap((group) => group.functionDeclarations.map((tool) => tool.name)),
);

describe('el registro coincide con el catalogo runtime', () => {
  it('toda herramienta NO marcada como de canal existe en el catalogo del chat', () => {
    const ausentes = SKILL_TOOL_ENTRIES
      .filter((entry) => !entry.channelOnly)
      .filter((entry) => !CATALOGO_DEL_CHAT.has(entry.name))
      .map((entry) => entry.name);

    expect(ausentes).toEqual([]);
  });

  it('toda herramienta marcada como de canal NO esta en el catalogo del chat', () => {
    // Si estuviera, la marca sobra y la interfaz diria una limitacion falsa.
    const marcadasDeMas = SKILL_TOOL_ENTRIES
      .filter((entry) => entry.channelOnly)
      .filter((entry) => CATALOGO_DEL_CHAT.has(entry.name))
      .map((entry) => entry.name);

    expect(marcadasDeMas).toEqual([]);
  });

  it('el registro cubre las herramientas de dominio del chat', () => {
    // No se exige cubrir TODAS (nodos remotos y envio por WhatsApp quedan fuera
    // a proposito), pero si las de los dominios que la pantalla presenta.
    const registradas = new Set(SKILL_TOOL_ENTRIES.map((entry) => entry.name));
    const dominios = [...CATALOGO_DEL_CHAT].filter((name) =>
      name.startsWith('gmail_')
      || name.startsWith('google_calendar_')
      || name.startsWith('drive_')
      || name.startsWith('workspace_'));

    const sinRegistrar = dominios.filter((name) => !registradas.has(name));
    expect(sinRegistrar).toEqual([]);
  });
});
