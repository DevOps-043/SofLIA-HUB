export type MeetingTriggerAction = 'start' | 'stop' | 'heartbeat';

export interface MeetingTriggerPayload {
  action: MeetingTriggerAction;
  provider: string | null;
  meetingTitle: string | null;
  meetingUrl: string | null;
  meetingCode: string | null;
  tabUrl: string | null;
  tabId: string | null;
  detectedAt: string;
  source: string | null;
  reason: string | null;
  extensionVersion: string | null;
  browser: string | null;
  triggerId: string;
  rawUrl: string;
}

/**
 * Retorno del inicio de sesion federado con SofLIA Learning.
 *
 * Llega por `soflia://auth/callback`, un canal que cualquier aplicacion local
 * puede registrar. Por eso el ticket no autoriza nada por si mismo: el canje
 * exige ademas el verificador que solo tiene el renderer que inicio el flujo.
 */
export interface AuthCallbackPayload {
  /** Ticket de un solo uso; ausente cuando Learning devuelve un error. */
  ticket: string | null;
  /** Correlaciona la respuesta con la solicitud viva del renderer. */
  state: string;
  /** Codigo estable de fallo emitido por Learning, si lo hubo. */
  error: string | null;
}

export type AppProtocolCommand =
  | {
      type: 'share-link';
      shareLink: string;
      rawUrl: string;
    }
  | {
      type: 'meeting-trigger';
      payload: MeetingTriggerPayload;
    }
  | {
      type: 'auth-callback';
      payload: AuthCallbackPayload;
    }
  | null;
