import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY, MODELS } from '../config';
import { getApiKeyWithCache } from './api-keys';
import { executeComputerTool } from './computer-use-service';
import {
  FLOW_ORCHESTRATOR_PROMPT,
  FLOW_RESPONSE_FALLBACK_PROMPT,
  FLOW_TRANSCRIPTION_PROMPT,
} from '../prompts/flow';

export type FlowIntent =
  | 'answer'
  | 'rewrite'
  | 'instruction'
  | 'email'
  | 'automation'
  | 'clarify';

export type FlowMode =
  | 'answer'
  | 'draft'
  | 'action';

export type FlowActionType =
  | 'none'
  | 'open_application'
  | 'open_url'
  | 'send_email'
  | 'desktop_automation'
  | 'send_to_chat';

export interface FlowAction {
  type: FlowActionType;
  label: string;
  description: string;
  target?: string;
  url?: string;
  task?: string;
  to?: string;
  subject?: string;
  body?: string;
  attachmentPaths?: string[];
  autoExecute: boolean;
  requiresConfirmation: boolean;
}

export interface FlowAnalysisResult {
  intent: FlowIntent;
  mode: FlowMode;
  title: string;
  lead: string;
  response: string;
  confidence: number;
  transcript: string;
  missing: string[];
  chatPrompt: string;
  action: FlowAction | null;
}

export interface FlowExecutionResult {
  success: boolean;
  message: string;
  detail?: string;
  raw?: unknown;
}

interface RawFlowAction {
  type?: unknown;
  label?: unknown;
  description?: unknown;
  target?: unknown;
  url?: unknown;
  task?: unknown;
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  attachmentPaths?: unknown;
  autoExecute?: unknown;
  requiresConfirmation?: unknown;
}

interface RawFlowAnalysis {
  intent?: unknown;
  mode?: unknown;
  title?: unknown;
  lead?: unknown;
  response?: unknown;
  confidence?: unknown;
  missing?: unknown;
  chatPrompt?: unknown;
  action?: RawFlowAction | null;
}

type DesktopAutomationExecutionPlan = {
  task: string;
  backend: 'auto' | 'browser' | 'desktop' | 'uia';
  startUrl?: string;
  preOpenTarget?: string;
};

type ComputerUseBridge = {
  openApplication?: (target: string) => Promise<{ success?: boolean; message?: string; error?: string }>;
};

const FLOW_MODEL = MODELS.FALLBACK || 'gemini-2.5-flash';
const FLOW_TRANSCRIPTION_MODEL = MODELS.TRANSCRIPTION || FLOW_MODEL;
const VALID_INTENTS: FlowIntent[] = ['answer', 'rewrite', 'instruction', 'email', 'automation', 'clarify'];
const VALID_MODES: FlowMode[] = ['answer', 'draft', 'action'];
const VALID_ACTIONS: FlowActionType[] = ['none', 'open_application', 'open_url', 'send_email', 'desktop_automation', 'send_to_chat'];

async function getGenAI(): Promise<GoogleGenerativeAI> {
  const dbApiKey = await getApiKeyWithCache('google');
  const key = dbApiKey || GOOGLE_API_KEY || '';
  return new GoogleGenerativeAI(key);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function parseJsonPayload<T>(rawText: string): T {
  const normalized = rawText.trim();
  try {
    return JSON.parse(normalized) as T;
  } catch {
    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(normalized.slice(start, end + 1)) as T;
    }
    throw new Error('Respuesta JSON invalida.');
  }
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.55;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeIntent(value: unknown, fallback: FlowIntent): FlowIntent {
  const normalized = asString(value).toLowerCase() as FlowIntent;
  return VALID_INTENTS.includes(normalized) ? normalized : fallback;
}

function normalizeMode(value: unknown, fallback: FlowMode): FlowMode {
  const normalized = asString(value).toLowerCase() as FlowMode;
  return VALID_MODES.includes(normalized) ? normalized : fallback;
}

function normalizeAction(rawAction: RawFlowAction | null | undefined): FlowAction | null {
  if (!rawAction) {
    return null;
  }

  const type = asString(rawAction.type).toLowerCase() as FlowActionType;
  if (!VALID_ACTIONS.includes(type)) {
    return null;
  }

  if (type === 'none') {
    return null;
  }

  return {
    type,
    label: asString(rawAction.label) || defaultActionLabel(type),
    description: asString(rawAction.description) || defaultActionDescription(type),
    target: asString(rawAction.target) || undefined,
    url: asString(rawAction.url) || undefined,
    task: asString(rawAction.task) || undefined,
    to: asString(rawAction.to) || undefined,
    subject: asString(rawAction.subject) || undefined,
    body: asString(rawAction.body) || undefined,
    attachmentPaths: asStringArray(rawAction.attachmentPaths),
    autoExecute: asBoolean(rawAction.autoExecute, false),
    requiresConfirmation: asBoolean(rawAction.requiresConfirmation, type === 'send_email'),
  };
}

function defaultActionLabel(type: FlowActionType): string {
  switch (type) {
    case 'open_application':
      return 'Abrir aplicacion';
    case 'open_url':
      return 'Abrir enlace';
    case 'send_email':
      return 'Enviar correo';
    case 'desktop_automation':
      return 'Ejecutar en escritorio';
    case 'send_to_chat':
      return 'Mandar al chat';
    default:
      return 'Continuar';
  }
}

function defaultActionDescription(type: FlowActionType): string {
  switch (type) {
    case 'open_application':
      return 'Abrira la aplicacion solicitada en tu equipo.';
    case 'open_url':
      return 'Abrira el sitio o enlace solicitado.';
    case 'send_email':
      return 'Enviara el correo con los datos detectados.';
    case 'desktop_automation':
      return 'Lanzara una automatizacion guiada por el agente de escritorio.';
    case 'send_to_chat':
      return 'Pasara la solicitud al chat principal.';
    default:
      return '';
  }
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.!,;:]+$/g, '').trim();
}

function normalizePotentialUrl(rawValue: string): string | null {
  const value = stripTrailingPunctuation(rawValue);
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(value)) {
    return `https://${value}`;
  }

  return null;
}

function resolveKnownTargetUrl(rawTarget: string): string | null {
  const normalized = stripTrailingPunctuation(rawTarget).toLowerCase();
  if (!normalized) {
    return null;
  }

  const aliases: Array<{ terms: string[]; url: string }> = [
    { terms: ['chatgpt', 'chat gpt', 'chat g p t'], url: 'https://chatgpt.com' },
    { terms: ['gmail'], url: 'https://mail.google.com' },
    { terms: ['google calendar', 'calendar', 'calendario de google'], url: 'https://calendar.google.com' },
    { terms: ['youtube'], url: 'https://www.youtube.com' },
  ];

  const match = aliases.find((item) => item.terms.some((term) => normalized === term));
  return match?.url || null;
}

function buildDirectOpenAnalysis(transcript: string, target: string, type: 'open_application' | 'open_url'): FlowAnalysisResult {
  const cleanedTarget = stripTrailingPunctuation(target);
  const url = type === 'open_url' ? normalizePotentialUrl(cleanedTarget) : null;
  const resolvedTarget = type === 'open_application' ? cleanedTarget : undefined;

  return {
    intent: 'instruction',
    mode: 'action',
    title: '',
    lead: '',
    response:
      type === 'open_url'
        ? `Voy a abrir ${url || cleanedTarget}.`
        : `Voy a abrir ${cleanedTarget}.`,
    confidence: 0.98,
    transcript,
    missing: [],
    chatPrompt: transcript,
    action: {
      type,
      label: type === 'open_url' ? 'Abrir enlace' : 'Abrir aplicacion',
      description:
        type === 'open_url'
          ? `Abrira ${url || cleanedTarget} en tu navegador.`
          : `Abrira ${cleanedTarget} en tu equipo.`,
      target: resolvedTarget,
      url: url || undefined,
      autoExecute: true,
      requiresConfirmation: false,
    },
  };
}

function buildDesktopAutomationAnalysis(transcript: string, response?: string): FlowAnalysisResult {
  return {
    intent: 'automation',
    mode: 'action',
    title: '',
    lead: '',
    response: response || 'Voy a intentar esta tarea en tu escritorio.',
    confidence: 0.93,
    transcript,
    missing: [],
    chatPrompt: transcript,
    action: {
      type: 'desktop_automation',
      label: 'Automatizar tarea',
      description: 'Usara el agente de escritorio para completar la tarea solicitada.',
      task: transcript,
      autoExecute: true,
      requiresConfirmation: false,
    },
  };
}

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

function buildFocusedDesktopTask(originalTask: string, appName: string): string {
  return `${originalTask}

Contexto operativo confirmado:
- ${appName} ya esta abierta o enfocada.
- No uses la barra de tareas, el menu Inicio ni el buscador de Windows.
- Trabaja solo sobre la ventana activa actual.
- Si necesitas buscar algo dentro de la app, usa primero sus controles internos o sus atajos de busqueda.`;
}

function buildFocusedBrowserTask(originalTask: string, startUrl: string): string {
  return `${originalTask}

Contexto operativo confirmado:
- Usa la version web oficial en ${startUrl}.
- No uses la barra de tareas, el menu Inicio ni resultados del buscador del sistema.
- Trabaja dentro de la pestana actual del navegador y verifica siempre la URL antes de continuar.`;
}

function buildDesktopAutomationExecutionPlan(task: string): DesktopAutomationExecutionPlan {
  const startUrl = inferKnownSiteFromTask(task);
  const normalized = task.toLowerCase();

  if (/\b(chatgpt|chat gpt|chat g p t|chat\.openai\.com)\b/.test(normalized)) {
    return {
      task,
      backend: 'desktop',
      startUrl: startUrl || undefined,
      preOpenTarget: 'ChatGPT',
    };
  }

  if (startUrl) {
    return {
      task: buildFocusedBrowserTask(task, startUrl),
      backend: 'browser',
      startUrl,
    };
  }

  return {
    task,
    backend: 'auto',
  };
}

async function openApplicationSilently(target: string): Promise<{ success: boolean; message?: string; error?: string }> {
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
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

function buildDeterministicAnalysis(transcript: string): FlowAnalysisResult | null {
  const normalized = transcript.trim();
  if (!normalized) {
    return null;
  }

  const openMatch = normalized.match(/^(?:abre|abrir)\s+(.+)$/i);
  if (!openMatch) {
    const automationStarts = /^(?:busca|buscar|entra|entrar|ve a|ir a|navega|navegar|selecciona|seleccionar|haz|hacer|mueve|desplazate|desplázate|cierra|cerrar)\b/i;
    const mentionsUIContext = /\b(chatgpt|gmail|outlook|whatsapp|chrome|edge|ventana|pestana|pestaña|conversacion|conversación|chat|pagina|página|sitio)\b/i;
    if (automationStarts.test(normalized) && mentionsUIContext.test(normalized)) {
      return buildDesktopAutomationAnalysis(normalized);
    }
    return null;
  }

  const rawTarget = stripTrailingPunctuation(openMatch[1] || '');
  if (!rawTarget) {
    return null;
  }

  const isCompoundTask =
    /\b(y|luego|despues|después)\b/i.test(rawTarget) ||
    /\b(busca|buscar|selecciona|seleccionar|escribe|escribir|navega|navegar|entra|entrar|ve a|ir a)\b/i.test(rawTarget);
  if (isCompoundTask) {
    return buildDesktopAutomationAnalysis(
      normalized,
      'Voy a abrir lo necesario y tratar de completar esa accion en tu escritorio.',
    );
  }

  const knownUrl = resolveKnownTargetUrl(rawTarget);
  if (knownUrl) {
    return buildDirectOpenAnalysis(transcript, knownUrl, 'open_url');
  }

  const url = normalizePotentialUrl(rawTarget);
  if (url) {
    return buildDirectOpenAnalysis(transcript, url, 'open_url');
  }

  return buildDirectOpenAnalysis(transcript, rawTarget, 'open_application');
}

function shouldAttachScreenshot(transcript: string): boolean {
  const normalized = transcript.toLowerCase();
  const visualSignals = [
    'pantalla',
    'imagen',
    'captura',
    'aqui',
    'aquí',
    'esto que ves',
    'ves aqui',
    'ves aquí',
    'esta ventana',
    'esta pagina',
    'esta página',
    'este boton',
    'este botón',
    'este campo',
    'seleccionado',
    'selecciona',
    'haz click aqui',
    'haz click aquí',
  ];

  return visualSignals.some((signal) => normalized.includes(signal));
}

function userExplicitlyAskedToContinueInChat(transcript: string): boolean {
  const normalized = transcript.toLowerCase();
  return [
    'chat principal',
    'manda al chat',
    'mandalo al chat',
    'envialo al chat',
    'continua en el chat',
    'continuar en el chat',
    'integra en chat',
    'pasalo al chat',
  ].some((term) => normalized.includes(term));
}

function inferIntentFromAction(action: FlowAction | null, transcript: string): FlowIntent {
  if (action?.type === 'send_email') {
    return 'email';
  }

  if (action?.type === 'desktop_automation') {
    return 'automation';
  }

  if (action?.type === 'open_application' || action?.type === 'open_url') {
    return 'instruction';
  }

  const normalized = transcript.toLowerCase();
  if (normalized.includes('correo') || normalized.includes('email')) {
    return 'email';
  }

  if (normalized.includes('mejora') || normalized.includes('redacta') || normalized.includes('prompt')) {
    return 'rewrite';
  }

  return 'answer';
}

function buildFlowFallbackRequestParts(text: string, base64Image?: string): any[] {
  const parts: any[] = [
    {
      text: `${FLOW_RESPONSE_FALLBACK_PROMPT}\n\nSOLICITUD DEL USUARIO:\n${text}`,
    },
  ];

  if (base64Image) {
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType: 'image/png',
      },
    });
  }

  return parts;
}

async function generateDirectFallbackResponse(text: string, base64Image?: string): Promise<string> {
  const ai = await getGenAI();
  const model = ai.getGenerativeModel({ model: FLOW_MODEL });
  const result = await model.generateContent(buildFlowFallbackRequestParts(text, base64Image));
  return result.response.text().trim();
}

async function buildFallbackAnalysis(transcript: string, base64Image?: string): Promise<FlowAnalysisResult> {
  const intent = inferIntentFromAction(null, transcript);
  const mode: FlowMode = intent === 'rewrite' || intent === 'email' ? 'draft' : 'answer';

  try {
    const response = await generateDirectFallbackResponse(transcript, base64Image);
    if (response) {
      return {
        intent,
        mode,
        title: '',
        lead: '',
        response,
        confidence: 0.44,
        transcript,
        missing: [],
        chatPrompt: transcript,
        action: null,
      };
    }
  } catch (error) {
    console.error('Flow fallback response error:', error);
  }

  return {
    intent,
    mode,
    title: '',
    lead: '',
    response: 'No pude responder con claridad esta vez. Intenta repetirlo o escribirlo en el panel.',
    confidence: 0.22,
    transcript,
    missing: [],
    chatPrompt: transcript,
    action: null,
  };
}

function normalizeAnalysis(rawAnalysis: RawFlowAnalysis, transcript: string): FlowAnalysisResult {
  const requestedAction = normalizeAction(rawAnalysis.action);
  const action =
    requestedAction?.type === 'send_to_chat' && !userExplicitlyAskedToContinueInChat(transcript)
      ? null
      : requestedAction;
  const inferredIntent = inferIntentFromAction(action, transcript);
  const modeFallback: FlowMode = action ? 'action' : inferredIntent === 'rewrite' || inferredIntent === 'email' ? 'draft' : 'answer';

  return {
    intent: normalizeIntent(rawAnalysis.intent, inferredIntent),
    mode: normalizeMode(rawAnalysis.mode, modeFallback),
    title: asString(rawAnalysis.title),
    lead: asString(rawAnalysis.lead),
    response: asString(rawAnalysis.response) || 'Ya entendi tu solicitud.',
    confidence: clampConfidence(asNumber(rawAnalysis.confidence, 0.68)),
    transcript,
    missing: asStringArray(rawAnalysis.missing),
    chatPrompt: asString(rawAnalysis.chatPrompt) || asString(rawAnalysis.response) || transcript,
    action,
  };
}

function buildFlowRequestParts(text: string, base64Image?: string): any[] {
  const parts: any[] = [
    {
      text: `${FLOW_ORCHESTRATOR_PROMPT}\n\nSOLICITUD DEL USUARIO:\n${text}`,
    },
  ];

  if (base64Image) {
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType: 'image/png',
      },
    });
  }

  return parts;
}

export async function processFlowInput(text: string, base64Image?: string): Promise<FlowAnalysisResult> {
  const transcript = text.trim();
  const deterministicAnalysis = buildDeterministicAnalysis(transcript);
  if (deterministicAnalysis) {
    return deterministicAnalysis;
  }

  const includeScreenshot = Boolean(base64Image && shouldAttachScreenshot(transcript));

  try {
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({
      model: FLOW_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(buildFlowRequestParts(transcript, includeScreenshot ? base64Image : undefined));
    const responseText = result.response.text().trim();
    const parsed = parseJsonPayload<RawFlowAnalysis>(responseText);

    return normalizeAnalysis(parsed, transcript);
  } catch (error) {
    console.error('Flow processing error:', {
      message: error instanceof Error ? error.message : String(error),
      model: FLOW_MODEL,
      includeScreenshot,
    });

    if (includeScreenshot) {
      try {
        const ai = await getGenAI();
        const retryModel = ai.getGenerativeModel({
          model: FLOW_MODEL,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });
        const retryResult = await retryModel.generateContent(buildFlowRequestParts(transcript));
        const retryParsed = parseJsonPayload<RawFlowAnalysis>(retryResult.response.text().trim());
        return normalizeAnalysis(retryParsed, transcript);
      } catch (retryError) {
        console.error('Flow processing retry without screenshot failed:', {
          message: retryError instanceof Error ? retryError.message : String(retryError),
          model: FLOW_MODEL,
        });
      }
    }

    return buildFallbackAnalysis(transcript, includeScreenshot ? base64Image : undefined);
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({
      model: FLOW_TRANSCRIPTION_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Value = reader.result as string;
        resolve(base64Value.split(',')[1] || '');
      };
      reader.onerror = () => reject(reader.error || new Error('No pude leer el audio.'));
      reader.readAsDataURL(audioBlob);
    });

    const result = await model.generateContent([
      { text: FLOW_TRANSCRIPTION_PROMPT },
      {
        inlineData: {
          data: base64Data,
          mimeType: audioBlob.type || 'audio/webm',
        },
      },
    ]);

    const responseText = result.response.text().trim();
    const parsed = parseJsonPayload<{ transcript?: unknown }>(responseText);
    return asString(parsed.transcript);
  } catch (error) {
    console.error('Flow transcription error:', error);
    throw error;
  }
}

function parseExecutionResult(rawResult: string): FlowExecutionResult {
  try {
    const parsed = JSON.parse(rawResult) as Record<string, any>;
    const success = Boolean(parsed.success);
    const message = asString(parsed.message) || (success ? 'Accion completada.' : 'No pude completar la accion.');
    const detail = asString(parsed.error) || undefined;
    return { success, message, detail, raw: parsed };
  } catch {
    return { success: false, message: 'La accion devolvio una respuesta no valida.', raw: rawResult };
  }
}

export async function executeFlowAction(action: FlowAction): Promise<FlowExecutionResult> {
  switch (action.type) {
    case 'open_application':
      if (!action.target) {
        return { success: false, message: 'Falta el nombre o ruta de la aplicacion.' };
      }
      return parseExecutionResult(await executeComputerTool('open_application', { path: action.target }));

    case 'open_url':
      if (!action.url) {
        return { success: false, message: 'Falta la URL a abrir.' };
      }
      return parseExecutionResult(await executeComputerTool('open_url', { url: action.url }));

    case 'send_email':
      if (!action.to || !action.body) {
        return { success: false, message: 'Faltan los datos minimos del correo.' };
      }
      return parseExecutionResult(
        await executeComputerTool('send_email', {
          to: action.to,
          subject: action.subject || 'Mensaje desde voz',
          body: action.body,
          attachment_paths: action.attachmentPaths || [],
          is_html: false,
        }),
      );

    case 'desktop_automation': {
      if (!action.task) {
        return { success: false, message: 'Falta la tarea para el agente de escritorio.' };
      }

      if (!window.desktopAgent) {
        return { success: false, message: 'Desktop Agent no esta disponible en esta ventana.' };
      }

      const executionPlan = buildDesktopAutomationExecutionPlan(action.task);
      let taskToRun = executionPlan.task;
      let backend = executionPlan.backend;
      let startUrl = executionPlan.startUrl;

      if (executionPlan.preOpenTarget) {
        const preOpenResult = await openApplicationSilently(executionPlan.preOpenTarget);
        if (preOpenResult.success) {
          taskToRun = buildFocusedDesktopTask(action.task, executionPlan.preOpenTarget);
          backend = 'desktop';
          startUrl = undefined;
        } else if (executionPlan.startUrl) {
          taskToRun = buildFocusedBrowserTask(action.task, executionPlan.startUrl);
          backend = 'browser';
          startUrl = executionPlan.startUrl;
        } else if (preOpenResult.error) {
          taskToRun = `${action.task}

Contexto adicional:
- El intento automatico de abrir ${executionPlan.preOpenTarget} fallo con este detalle: ${preOpenResult.error}
- Evita la barra de tareas y el menu Inicio; prioriza enfocarte en una ventana existente si ya esta abierta.`;
        }
      }

      const result = await window.desktopAgent.executeTask(taskToRun, {
        maxSteps: 80,
        backend,
        startUrl,
      });

      return {
        success: Boolean(result?.success),
        message: asString(result?.message) || (result?.success ? 'Automatizacion iniciada.' : 'No pude iniciar la automatizacion.'),
        detail: asString(result?.error) || undefined,
        raw: result,
      };
    }

    case 'send_to_chat':
      return { success: true, message: 'Solicitud lista para enviarse al chat.' };

    default:
      return { success: false, message: 'No hay una accion ejecutable asociada.' };
  }
}
