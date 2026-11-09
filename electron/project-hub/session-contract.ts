import { z } from 'zod';
import type { ProjectHubResult } from './types';

export const MAX_PROJECT_HUB_BODY_BYTES = 2 * 1024 * 1024;
export const MAX_PROJECT_HUB_RESPONSE_BYTES = 4 * 1024 * 1024;
export const MAX_PROJECT_HUB_SESSION_BYTES = 4 * 1024 * 1024;
export const MAX_PROJECT_HUB_CIPHER_BYTES = 8 * 1024 * 1024;
export const PROJECT_HUB_TIMEOUT_MS = 15_000;
export const PROJECT_HUB_READ_RETRIES = 2;
export const PROJECT_HUB_RETRY_BACKOFF_MS = 250;

export const projectHubToken = z.string().min(1).max(65_536).regex(/^[!-~]+$/u);
export const projectHubWorkspaces = z.array(z.object({
  id: z.string().uuid(), name: z.string().min(1).max(512), slug: z.string().max(512),
  role: z.string().min(1).max(128), logoUrl: z.string().max(4096).optional(),
})).max(1000);
export const projectHubStoredCredentials = z.object({ refreshToken: projectHubToken, workspaces: projectHubWorkspaces });
export const projectHubTokenPair = z.object({
  access_token: projectHubToken, refresh_token: projectHubToken, expires_in: z.number().int().min(1).max(31_536_000),
});
export const projectHubExchange = projectHubTokenPair.extend({ workspaces: projectHubWorkspaces });
export const projectHubStoredPayload = projectHubStoredCredentials.extend({
  version: z.literal(1), userId: z.string().min(1).max(256),
}).strict();

export class ProjectHubError extends Error {
  constructor(readonly code: string, message: string, readonly status?: number) { super(message); }
}
export function projectHubHttpError(status: number): ProjectHubError {
  const message = status === 401 ? 'Project Hub requiere renovar la sesión.'
    : status === 403 ? 'No tienes permiso para realizar esta operación en Project Hub.'
      : status === 404 ? 'No se encontró el recurso solicitado en Project Hub.'
        : status === 409 ? 'La operación entra en conflicto con el estado actual de Project Hub.'
          : status === 429 ? 'Project Hub recibió demasiadas solicitudes; inténtalo más tarde.'
            : status >= 500 ? 'Project Hub no está disponible.' : 'Project Hub rechazó la solicitud.';
  return new ProjectHubError(`HTTP_${status}`, message, status);
}
export function projectHubFailure(error: unknown): ProjectHubResult<never> {
  if (error instanceof ProjectHubError) return { success: false, code: error.code, error: error.message };
  return { success: false, code: 'UNAVAILABLE', error: 'Project Hub no está disponible.' };
}
