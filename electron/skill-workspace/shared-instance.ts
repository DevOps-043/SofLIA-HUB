import { SkillWorkspaceService } from './service';

/**
 * Instancia compartida del servicio de espacios de trabajo.
 *
 * El arranque crea la suya en `service-factory` y la registra aqui, de modo
 * que las superficies que no reciben servicios por inyeccion —el agente de
 * WhatsApp entra por su propia cadena de comandos— usen la MISMA instancia y
 * no un segundo indice sobre el mismo directorio.
 */
let shared: SkillWorkspaceService | null = null;

export function setSkillWorkspaceService(service: SkillWorkspaceService): void {
  shared = service;
}

export function getSkillWorkspaceService(): SkillWorkspaceService {
  // Respaldo defensivo: si una superficie llega antes del registro, se crea
  // con la ruta por defecto en vez de fallar el flujo del usuario.
  if (!shared) shared = new SkillWorkspaceService();
  return shared;
}
