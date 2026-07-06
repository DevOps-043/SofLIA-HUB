import { ipcMain } from 'electron';
import {
  GEMINI_GROUNDING_API,
  GEMINI_GROUNDING_TOOLS,
} from '../src/shared/gemini-grounding-config';

interface GroundedGenerateInput {
  modelName?: string;
  apiKey?: string;
  body?: Record<string, any>;
}

export function registerAiGroundingHandler(): void {
  ipcMain.handle('ai:generate-grounded', async (_event, input: GroundedGenerateInput) => {
    try {
      const modelName = normalizeModelName(input?.modelName);
      const apiKey = normalizeApiKey(input?.apiKey);
      const body = validateGroundingBody(input?.body);
      const rawBody = JSON.stringify(body);
      if (rawBody.length > GEMINI_GROUNDING_API.maxRequestBytes) {
        return { success: false, status: 413, error: 'La solicitud de investigacion es demasiado grande.' };
      }

      const response = await fetch(`${GEMINI_GROUNDING_API.generateContentBaseUrl}/${modelName}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: rawBody,
      });

      const raw = await response.text();
      const payload = parseJsonResponse(raw);
      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error: sanitizeProviderError(payload?.error?.message || `HTTP ${response.status}`),
        };
      }

      return { success: true, payload };
    } catch (error) {
      return { success: false, error: sanitizeProviderError(error instanceof Error ? error.message : String(error || 'Error desconocido')) };
    }
  });
}

function normalizeModelName(modelName?: string): string {
  const normalized = String(modelName || '').replace(/^models\//, '').trim();
  if (!normalized || !GEMINI_GROUNDING_API.modelNamePattern.test(normalized)) {
    throw new Error('Modelo de investigacion no valido.');
  }
  return normalized;
}

function normalizeApiKey(apiKey?: string): string {
  const normalized = String(apiKey || '').trim();
  if (!normalized || normalized.length < 20 || normalized.length > 512) {
    throw new Error('Clave de investigacion no configurada.');
  }
  return normalized;
}

function validateGroundingBody(body?: Record<string, any>): Record<string, any> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Solicitud de investigacion no valida.');
  }

  const tools = Array.isArray(body.tools) ? body.tools : [];
  const hasOnlyGroundingTools = tools.every((tool: any) => {
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) return false;
    const keys = Object.keys(tool);
    return keys.length === 1 && (keys[0] === GEMINI_GROUNDING_TOOLS.googleSearch || keys[0] === GEMINI_GROUNDING_TOOLS.urlContext);
  });
  if (!tools.length || !hasOnlyGroundingTools) {
    throw new Error('Herramientas de investigacion no validas.');
  }

  return body;
}

function parseJsonResponse(raw: string): any {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function sanitizeProviderError(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, '[api-key]')
    .replace(/key=[^&\s]+/g, 'key=[api-key]')
    .slice(0, 500);
}
