import type { BrowserAgentShortcut } from '../../../shared/browser-agent-shortcuts';
import type { TabContextAttachment } from '../../../services/integrated-browser-service';

export interface PreparedBrowserShortcut { entry: BrowserAgentShortcut; contextKey: string; profileRevision: number }
export function assertBrowserShortcutTurn(prepared: PreparedBrowserShortcut, context: {
  contextKey: string; tabs: TabContextAttachment[]; hasOtherSources: boolean; hasSkill: boolean; specialMode: boolean;
}): void {
  if (prepared.contextKey !== context.contextKey) throw new Error('La conversación o cuenta cambió. Selecciona el atajo de nuevo.');
  if (prepared.entry.scope !== 'selected-tabs' || prepared.entry.permission !== 'read-fragments') throw new Error('Permisos de atajo no compatibles.');
  if (!context.tabs.length || context.tabs.length > 8 || context.tabs.some(tab => tab.expected?.profileRevision !== prepared.profileRevision)) throw new Error('Selecciona de una a ocho pestañas del perfil del atajo.');
  if (context.hasOtherSources || context.hasSkill || context.specialMode) throw new Error('Este atajo sólo analiza pestañas. Retira otros adjuntos y usa un chat sin Skill ni modos especiales.');
}
