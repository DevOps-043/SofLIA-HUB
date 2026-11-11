import { STUDIO_RECORDING_NOTICE_HEADER, STUDIO_RECORDING_NOTICE_REQUIRED, studioRequestSchema, studioResponseSchema, type StudioResult } from '../src/shared/live-studio.contract';
import { learningLiveEndpoint, readLearningResponse } from './learning-live-http';
import { createLogger } from './utils/logger';

const log = createLogger('learning-studio');
const joinFailures = {
  identidad: 'No se pudo comprobar tu sesión del Hub para conectar el audio y video.',
  solicitud: 'No se pudo contactar a Learning para conectar el audio y video.',
  respuesta: 'El Hub recibió una respuesta de Learning que no pudo validar para conectar el audio y video.',
  espera: 'Learning no completó la solicitud de audio y video en 25 segundos.',
};
const integrationUnavailable = 'El estudio de Learning todavía no está habilitado para Soflia Hub.';
const knownJoinUnavailableErrors: Record<string, string> = {
  'Soflia debe verificar privacidad y retención de la grabación del proveedor antes de habilitar webinars.': 'Actualiza Learning para habilitar la aceptación del aviso de grabación desde el Hub.',
  'Verifica privacidad, retención y grabación cloud de la cuenta Video SDK antes de activarla.': 'El administrador de Soflia debe verificar la privacidad, retención y grabación en la nube para activar el aula.',
  'La cuenta de la organización no tiene capacidad de grabación para este evento. No se requiere licencia individual del instructor.': 'La cuenta anfitriona de Soflia no tiene habilitada la grabación en la nube o la capacidad necesaria para este evento.',
  'El evento no está preparado para grabarse automáticamente en Soflia.': 'Esta sesión requiere que el administrador de Soflia habilite la grabación automática en la nube para el evento.',
  'La reunión no tiene credenciales disponibles': 'El administrador de Soflia debe revisar la conexión de esta sesión con la cuenta anfitriona.',
  'La cuenta central no tiene correo verificado para el webinar.': 'La cuenta anfitriona de Soflia necesita un correo verificado para conectar el webinar.',
  'Configura ZOOM_CLIENT_ID para activar Zoom': 'El administrador de Soflia debe completar la configuración de la cuenta anfitriona en Learning.',
  'Configura ZOOM_CLIENT_SECRET para activar Zoom': 'El administrador de Soflia debe completar la configuración de la cuenta anfitriona en Learning.',
  'Configura ZOOM_ACCOUNT_ID para activar Zoom': 'El administrador de Soflia debe completar la configuración de la cuenta anfitriona en Learning.',
  'Zoom alcanzó su límite de solicitudes. Espera antes de volver a intentar la operación.': 'El servicio audiovisual alcanzó su límite de solicitudes. Espera un momento antes de conectar de nuevo.',
  'No se pudo acceder al módulo In Live. Verifica su configuración.': 'Learning no pudo consultar los datos necesarios para conectar esta sesión. El administrador de Soflia debe revisar el servicio.',
  'No se pudo verificar la organización': 'Learning no pudo consultar la organización de esta sesión. El administrador de Soflia debe revisar el servicio.',
};
const knownErrors: Record<string, string> = {
  [STUDIO_RECORDING_NOTICE_REQUIRED]: 'Acepta el aviso de privacidad de la grabación en el Hub para conectar la sesión.',
  'Falta configurar Meeting SDK en Learning': 'La conexión audiovisual aún no está configurada en Learning. El administrador de Soflia debe completar la configuración para habilitar el ingreso.',
  'Zoom no autorizó al anfitrión; revisa el permiso ZAK': 'No se autorizó el ingreso del anfitrión. El administrador de Soflia debe revisar los permisos de la conexión audiovisual.',
  'Esta sesión aún no tiene reunión Zoom': 'La conexión audiovisual de esta sesión aún no está preparada en Learning.',
  'Tu chat está en modo lectura': 'Tu chat está en modo lectura',
  'No hay participantes conectados para distribuir': 'No hay participantes conectados para distribuir',
  'El contenido pertenece a otro curso': 'El contenido pertenece a otro curso',
  'La sesión está cerrada': 'La sesión está cerrada',
};

export async function requestLearningStudio(input: unknown, deps: { baseUrl: string; getIdentity: () => Promise<{ userId: string; accessToken: string } | null>; fetcher?: typeof fetch }): Promise<StudioResult> {
  const parsed = studioRequestSchema.safeParse(input);
  const endpoint = learningLiveEndpoint(deps.baseUrl, 'studio');
  if (!parsed.success || !endpoint) return { success: false, code: 'access_denied', error: 'Solicitud del estudio inválida.' };
  // Las API anteriores validan el JSON con strict(); las cabeceras conservan su contrato.
  const operation = parsed.data.operation;
  const joining = operation.type === 'zoom';
  const recordingNotice = joining ? operation.recording_notice_version : undefined;
  const request={organization_slug:parsed.data.organization_slug,session_id:parsed.data.session_id,operation:joining ? { type: 'zoom' } : operation};
  const body = JSON.stringify(request);
  if (Buffer.byteLength(body) > 32768) return { success: false, code: 'access_denied', error: 'El contenido supera el límite de la sesión.' };
  let phase: keyof typeof joinFailures = 'identidad';
  let signal: AbortSignal | undefined;
  let status: number | undefined;
  try {
    const identity = await deps.getIdentity();
    if (!identity) return { success: false, code: 'not_ready', error: 'Inicia sesión para abrir el estudio.' };
    phase = 'solicitud';
    signal = AbortSignal.timeout(25000);
    const headers = {
      'Content-Type': 'application/json',
      'X-Soflia-Studio-Participation': '1',
      Authorization: `Bearer ${identity.accessToken}`,
      ...(recordingNotice === undefined ? {} : { [STUDIO_RECORDING_NOTICE_HEADER]: String(recordingNotice) }),
    };
    const response = await (deps.fetcher || fetch)(endpoint, { method: 'POST', redirect: 'error', cache: 'no-store', signal, headers, body });
    status = response.status;
    if (!response.ok) {
      if (joining && status >= 500) log.warn({ fase: 'http', status }, 'Falló la autorización audiovisual de Learning');
      let error = response.status === 409 ? 'El estado cambió. Se actualizará el panel; revisa la acción antes de reintentar.' : response.status === 404 || response.status === 405 ? integrationUnavailable : response.status === 429 ? 'Espera un momento antes de continuar.' : response.status >= 500 ? 'No se pudo conectar el estudio. Revisa la configuración de Learning.' : 'Learning no autorizó esta operación.';
      const detail = await readLearningResponse(response, 4096).catch(() => null) as { error?: unknown } | null;
      if (response.status === 401) {
        // El filtro de cookies web puede rechazar una ruta aún sin habilitar para bearer.
        if (detail?.error === 'UNAUTHENTICATED') return { success: false, code: 'unavailable', error: integrationUnavailable };
        return { success: false, code: 'not_ready', error: 'Learning no pudo validar tu sesión. Vuelve a iniciar sesión en Hub.' };
      }
      if (response.status === 404 && detail?.error === 'Sesión no encontrada') return { success: false, code: 'access_denied', error: 'Esta sesión ya no está disponible en tu organización.' };
      if (typeof detail?.error === 'string') {
        if (joining && status === 503 && Object.prototype.hasOwnProperty.call(knownJoinUnavailableErrors, detail.error)) error = knownJoinUnavailableErrors[detail.error];
        else if (Object.prototype.hasOwnProperty.call(knownErrors, detail.error)) error = knownErrors[detail.error];
      }
      return { success: false, code: response.status === 429 ? 'rate_limited' : response.status === 409 ? 'conflict' : response.status >= 500 || [404, 405, 429].includes(response.status) ? 'unavailable' : 'access_denied', error };
    }
    phase = 'respuesta';
    const result = studioResponseSchema.parse(await readLearningResponse(response, 2 * 1024 * 1024));
    if (result.snapshot && (result.snapshot.session_id !== parsed.data.session_id || result.snapshot.user_id !== identity.userId)) throw new Error('Actor incompatible');
    if(result.recording_snapshot && (result.recording_snapshot.session_id!==parsed.data.session_id || result.recording_snapshot.user_id!==identity.userId))throw new Error('Archivo incompatible');
    if(result.playback){
      if(result.playback.session_id!==parsed.data.session_id || result.playback.user_id!==identity.userId || parsed.data.operation.type!=='recordings' || parsed.data.operation.operation.type!=='play' || result.playback.run_id!==parsed.data.operation.operation.run_id)throw new Error('Reproducción incompatible');
      for(const segment of result.playback.segments){const target=new URL(segment.url);if(target.protocol!=='https:'||!target.hostname.endsWith('.supabase.co')||!target.pathname.startsWith('/storage/v1/object/sign/live-recordings/')||target.username||target.password||target.port)throw new Error('Vídeo incompatible');}
    }
    phase = 'identidad';
    if ((await deps.getIdentity())?.userId !== identity.userId) return { success: false, code: 'not_ready', error: 'La cuenta cambió durante la operación.' };
    if (result.upload) {
      const target = new URL(result.upload.url);
      if (target.protocol !== 'https:' || !target.hostname.endsWith('.supabase.co') || !target.pathname.startsWith('/storage/v1/object/upload/sign/live-studio-assets/') || target.username || target.password) throw new Error('Subida incompatible');
    }
    return { success: true, ...result };
  } catch {
    if (!joining) return { success: false, code: 'unavailable', error: 'No se pudo completar la operación del estudio.' };
    const failure = phase !== 'identidad' && signal?.aborted ? 'espera' : phase;
    log.warn({ fase: failure, status }, 'Falló la autorización audiovisual de Learning');
    return { success: false, code: 'unavailable', error: joinFailures[failure] };
  }
}
