export type BrowserVoiceAction = 'next-tab' | 'previous-tab' | 'task-status' | 'pause' | 'resume' | 'stop' | 'take-control';
export interface BrowserVoiceResult { success: boolean; message?: string; error?: string }
const commands: Record<string, BrowserVoiceAction> = {
  'siguiente pestana': 'next-tab', 'pestana siguiente': 'next-tab',
  'pestana anterior': 'previous-tab', 'anterior pestana': 'previous-tab',
  'estado': 'task-status', 'estado de la tarea': 'task-status',
  'pausa': 'pause', 'pausar': 'pause', 'reanuda': 'resume', 'reanudar': 'resume',
  'deten': 'stop', 'detener': 'stop', 'toma el control': 'take-control', 'tomar control': 'take-control',
};
/** Sólo órdenes literales del dictado humano; nunca instrucciones de una página/modelo. */
export function parseBrowserVoiceCommand(text: string): BrowserVoiceAction | null {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[.,!?¿¡]+$/g, '').replace(/\s+/g, ' ');
  if (!normalized.startsWith('navegador ')) return null;
  return commands[normalized.slice(10).trim()] ?? null;
}
export function validateBrowserVoiceAction(input: unknown): BrowserVoiceAction {
  if (typeof input !== 'string' || !Object.values(commands).includes(input as BrowserVoiceAction)) throw new Error('Comando de navegador no permitido.');
  return input as BrowserVoiceAction;
}
