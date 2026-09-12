import { describe, expect, it } from 'vitest';
import { assertBrowserShortcutTurn, type PreparedBrowserShortcut } from '../../adapters/desktop_ui/chat-ui/browser-shortcut-turn';

const prepared: PreparedBrowserShortcut = { contextKey: 'cuenta-chat', profileRevision: 4,
  entry: { id: 'atajo', title: 'Resumen', instruction: 'Resume', scope: 'selected-tabs', permission: 'read-fragments' } };
const context = () => ({ contextKey: 'cuenta-chat', hasOtherSources: false, hasSkill: false, specialMode: false,
  tabs: [{ tabId: 'tab', title: 'Documento', url: 'https://example.com', text: '', isCurrent: true, expected: { profileRevision: 4, documentToken: 'documento' } }] });

describe('Alcance de atajos en el envío del chat', () => {
  it('sólo admite pestañas del perfil declarado sin capacidades adicionales', () => {
    expect(() => assertBrowserShortcutTurn(prepared, context())).not.toThrow();
  });
  it.each(['hasOtherSources', 'hasSkill', 'specialMode'] as const)('rechaza ampliar con %s', property => {
    expect(() => assertBrowserShortcutTurn(prepared, { ...context(), [property]: true })).toThrow('sólo analiza');
  });
  it('no rebaja a chat libre al quitar las pestañas o cambiar identidad/conversación', () => {
    expect(() => assertBrowserShortcutTurn(prepared, { ...context(), tabs: [] })).toThrow('pestañas');
    expect(() => assertBrowserShortcutTurn(prepared, { ...context(), contextKey: 'otro' })).toThrow('cambió');
    expect(() => assertBrowserShortcutTurn({ ...prepared, profileRevision: 8 }, context())).toThrow('perfil');
    expect(() => assertBrowserShortcutTurn(prepared, { ...context(), tabs: Array(9).fill(context().tabs[0]) })).toThrow('ocho');
  });
});
