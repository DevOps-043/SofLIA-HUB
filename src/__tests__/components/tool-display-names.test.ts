import { describe, expect, it } from 'vitest';
import { TOOL_DISPLAY_NAMES, getToolDisplayName } from '../../adapters/desktop_ui/chat-ui/tool-display-names';
import { WHATSAPP_SEND_FILE_TOOL } from '../../services/gemini-tools/native-tools';
import { SKILL_WORKSPACE_TOOL_NAMES } from '../../shared/skills/workspace-tool-names';
import {
  COMPUTER_TOOL_NAMES,
  GOOGLE_WORKSPACE_TOOL_NAMES,
  INTEGRATED_BROWSER_TOOL_NAMES,
  NATIVE_AI_TOOL_NAMES,
  PROJECT_HUB_TOOL_NAMES,
} from '../../services/gemini-tools/tool-names';

/**
 * Herramientas que el pipeline emite por su cuenta hacia `onToolCall` sin estar
 * declaradas ante el modelo (estado visible de investigacion y navegador).
 */
const SYNTHETIC_TOOL_NAMES = [
  'web_research',
  'research_actions',
  'inspect_browser_view',
  'browser_read_fallback',
];

const DECLARED_TOOL_NAMES = [
  ...COMPUTER_TOOL_NAMES,
  ...PROJECT_HUB_TOOL_NAMES,
  ...GOOGLE_WORKSPACE_TOOL_NAMES,
  ...INTEGRATED_BROWSER_TOOL_NAMES,
  ...NATIVE_AI_TOOL_NAMES,
  ...SKILL_WORKSPACE_TOOL_NAMES,
  // Se declara fuera de NATIVE_AI_TOOLS: se agrega segun el canal activo.
  WHATSAPP_SEND_FILE_TOOL.name,
];

describe('TOOL_DISPLAY_NAMES', () => {
  it('cubre toda herramienta declarada ante el modelo', () => {
    const sinEtiqueta = DECLARED_TOOL_NAMES.filter((name) => !TOOL_DISPLAY_NAMES[name]);
    expect(sinEtiqueta).toEqual([]);
  });

  it('cubre las herramientas sinteticas del pipeline', () => {
    const sinEtiqueta = SYNTHETIC_TOOL_NAMES.filter((name) => !TOOL_DISPLAY_NAMES[name]);
    expect(sinEtiqueta).toEqual([]);
  });

  it('no conserva etiquetas de herramientas inexistentes', () => {
    const conocidas = new Set([...DECLARED_TOOL_NAMES, ...SYNTHETIC_TOOL_NAMES]);
    const huerfanas = Object.keys(TOOL_DISPLAY_NAMES).filter((name) => !conocidas.has(name));
    expect(huerfanas).toEqual([]);
  });

  it('usa etiquetas legibles y no el nombre tecnico', () => {
    for (const [name, label] of Object.entries(TOOL_DISPLAY_NAMES)) {
      expect(label, `${name} deberia tener una etiqueta en lenguaje natural`).not.toMatch(/_/);
      expect(label.length, `${name} deberia tener una etiqueta corta`).toBeLessThanOrEqual(40);
    }
  });

  it('getToolDisplayName devuelve la etiqueta mapeada o un fallback sin guiones ni prefijos', () => {
    expect(getToolDisplayName('workspace_read_file')).toBe('Leyendo archivo...');
    expect(getToolDisplayName('workspace_custom_unknown_action')).toBe('Custom unknown action...');
    expect(getToolDisplayName(undefined)).toBe('Procesando...');
  });
});

