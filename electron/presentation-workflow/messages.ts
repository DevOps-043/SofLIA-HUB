import type { PresentacionData } from './types';

export const START_CANCEL_MESSAGE = 'Si quieres salir del flujo en cualquier momento, escribe "cancelar".';
export const START_DATA_MESSAGE = 'Hola. Vamos a crear una presentación ejecutiva.\n\nDime:\n1. Nombre de la empresa cliente.\n2. Correo electrónico de envío.';
export const PROCESSING_MESSAGE = 'Sigo analizando y generando el resumen. Por favor espera...';
export const GENERATING_MESSAGE = 'Terminando de generar y enviar tu presentacion. Espera un momento...';
export const MISSING_DATA_CONTEXT_MESSAGE = 'Sigo dentro del flujo de presentacion. Necesito empresa y correo. Si quieres salir, escribe "cancelar".';
export const MISSING_DATA_MESSAGE = 'No pude identificar claramente la empresa y el correo. Por favor, indicalos nuevamente.';
export const APPROVAL_HELP_MESSAGE = 'Sigo dentro del flujo. Responde "si" para generar la presentacion o "cancelar" para salir.';
export const APPROVED_MESSAGE = 'Aprobado. Generando la presentacion con Gamma...';
export const CANCELLED_MESSAGE = 'Flujo cancelado.';
export const INACTIVITY_MESSAGE = 'Flujo cancelado por inactividad despues de 5 minutos. Si quieres retomarlo, inicia el flujo de nuevo.';
export const PROCESSING_ERROR_MESSAGE = 'Ocurrio un error al procesar el resumen. Intenta de nuevo mas tarde.';
export const GAMMA_ERROR_MESSAGE = 'Ocurrio un error al comunicarse con Gamma API.';

export function buildDataConfirmedMessage(data: PresentacionData): string {
  return `Perfecto. Empresa: *${data.clientCompanyName}*\nCorreo: *${data.clientEmail}*\n\nPreparando resumen ejecutivo...`;
}
