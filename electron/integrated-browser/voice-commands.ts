import type { IntegratedBrowserService } from './service';
import { validateBrowserVoiceAction, type BrowserVoiceResult } from '../../src/shared/browser-voice';

/** Adaptador humano del mismo navegador/supervisor, sin otro modelo ni runtime. */
export async function executeBrowserVoiceCommand(browser: IntegratedBrowserService, raw: unknown, confirmResume: () => Promise<boolean>, assertCaller: () => void): Promise<BrowserVoiceResult> {
  const action = validateBrowserVoiceAction(raw);
  assertCaller();
  const state = browser.getState();
  if (action === 'task-status') {
    const task = state.agentTask;
    const states = { starting: 'preparándose', executing: 'en ejecución', pausing: 'terminando de pausar', paused: 'pausada', stopping: 'deteniéndose' };
    return { success: true, message: task ? `La tarea está ${states[task.status]}. Lleva ${task.currentStep} de ${task.maxSteps} pasos.` : 'No hay una tarea visual activa en el navegador.' };
  }
  if (action === 'next-tab' || action === 'previous-tab') {
    if (state.agentControlling || state.agentTask) throw new Error('Toma el control antes de cambiar pestañas por voz.');
    const tabs = state.tabs.filter(tab => !tab.isDetached);
    const current = tabs.findIndex(tab => tab.id === state.activeTabId);
    if (current < 0 || tabs.length < 2) return { success: true, message: 'No hay otra pestaña acoplada para seleccionar.' };
    const index = (current + (action === 'next-tab' ? 1 : -1) + tabs.length) % tabs.length;
    browser.activateTab(tabs[index].id);
    return { success: true, message: `Pestaña ${index + 1} de ${tabs.length} seleccionada.` };
  }
  const task = state.agentTask;
  if (!task || state.profileRevision === undefined) return { success: true, message: 'No hay una tarea visual activa en el navegador.' };
  const request = { action, taskId: task.taskId, taskRevision: task.revision, profileRevision: state.profileRevision };
  const expires = Date.now() + 30_000;
  if (action === 'resume') {
    if (task.status !== 'paused') throw new Error('La tarea no está pausada.');
    if (!await confirmResume()) return { success: true, message: 'Se conservó la pausa.' };
  }
  assertCaller();
  if (Date.now() >= expires) throw new Error('La confirmación venció.');
  browser.controlAgentTask(request);
  return { success: true, message: action === 'resume' ? 'Reanudación solicitada. Se observará de nuevo la página.' : action === 'pause' ? 'Pausa solicitada. Espera a que termine la operación en curso.' : 'Detención solicitada. El control se libera al terminar la operación en curso.' };
}
