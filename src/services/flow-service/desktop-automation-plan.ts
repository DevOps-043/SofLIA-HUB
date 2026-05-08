import { asString } from './normalizers';
import type { ComputerUseBridge, DesktopAutomationExecutionPlan } from './types';

function inferKnownSiteFromTask(task: string): string | null {
  const normalized = task.toLowerCase();
  if (/\b(chatgpt|chat gpt|chat g p t|chat\.openai\.com)\b/.test(normalized)) {
    return 'https://chatgpt.com';
  }
  if (/\b(gmail|mail\.google)\b/.test(normalized)) {
    return 'https://mail.google.com';
  }
  if (/\b(google calendar|calendar\.google|calendario de google|calendario)\b/.test(normalized)) {
    return 'https://calendar.google.com';
  }
  if (/\b(youtube)\b/.test(normalized)) {
    return 'https://www.youtube.com';
  }
  return null;
}

export function buildFocusedDesktopTask(originalTask: string, appName: string): string {
  return `${originalTask}

Contexto operativo confirmado:
- ${appName} ya esta abierta o enfocada.
- No uses la barra de tareas, el menu Inicio ni el buscador de Windows.
- Trabaja solo sobre la ventana activa actual.
- Si necesitas buscar algo dentro de la app, usa primero sus controles internos o sus atajos de busqueda.`;
}

export function buildFocusedBrowserTask(originalTask: string, startUrl: string): string {
  return `${originalTask}

Contexto operativo confirmado:
- Usa la version web oficial en ${startUrl}.
- No uses la barra de tareas, el menu Inicio ni resultados del buscador del sistema.
- Trabaja dentro de la pestana actual del navegador y verifica siempre la URL antes de continuar.`;
}

export function buildDesktopAutomationExecutionPlan(task: string): DesktopAutomationExecutionPlan {
  const startUrl = inferKnownSiteFromTask(task);
  const normalized = task.toLowerCase();
  if (/\b(chatgpt|chat gpt|chat g p t|chat\.openai\.com)\b/.test(normalized)) {
    return { task, backend: 'desktop', startUrl: startUrl || undefined, preOpenTarget: 'ChatGPT' };
  }
  if (startUrl) {
    return { task: buildFocusedBrowserTask(task, startUrl), backend: 'browser', startUrl };
  }
  return { task, backend: 'auto' };
}

export async function openApplicationSilently(
  target: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const computerUse = (window as typeof window & { computerUse?: ComputerUseBridge }).computerUse;
  if (!computerUse?.openApplication) {
    return { success: false, error: 'open_application no esta disponible en esta ventana.' };
  }

  try {
    const result = await computerUse.openApplication(target);
    return {
      success: Boolean(result?.success),
      message: asString(result?.message) || undefined,
      error: asString(result?.error) || undefined,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}
