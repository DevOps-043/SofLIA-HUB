import { studioRequestSchema, studioResponseSchema, type StudioResult } from '../src/shared/live-studio.contract';
import { learningLiveEndpoint, readLearningResponse } from './learning-live-http';

const integrationUnavailable = 'El estudio de Learning todavía no está habilitado para Soflia Hub.';
const knownErrors: Record<string, string> = {
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
  const body = JSON.stringify(parsed.data);
  if (Buffer.byteLength(body) > 32768) return { success: false, code: 'access_denied', error: 'El contenido supera el límite de la sesión.' };
  try {
    const identity = await deps.getIdentity();
    if (!identity) return { success: false, code: 'not_ready', error: 'Inicia sesión para abrir el estudio.' };
    const response = await (deps.fetcher || fetch)(endpoint, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${identity.accessToken}` }, body });
    if (!response.ok) {
      let error = response.status === 409 ? 'El estado cambió. Se actualizará el panel; revisa la acción antes de reintentar.' : response.status === 404 || response.status === 405 ? integrationUnavailable : response.status === 429 ? 'Espera un momento antes de continuar.' : response.status >= 500 ? 'No se pudo conectar el estudio. Revisa la configuración de Learning.' : 'Learning no autorizó esta operación.';
      const detail = await readLearningResponse(response, 4096).catch(() => null) as { error?: unknown } | null;
      if (response.status === 401) {
        // El filtro de cookies web puede rechazar una ruta aún sin habilitar para bearer.
        if (detail?.error === 'UNAUTHENTICATED') return { success: false, code: 'unavailable', error: integrationUnavailable };
        return { success: false, code: 'not_ready', error: 'Learning no pudo validar tu sesión. Vuelve a iniciar sesión en Hub.' };
      }
      if (response.status === 404 && detail?.error === 'Sesión no encontrada') return { success: false, code: 'access_denied', error: 'Esta sesión ya no está disponible en tu organización.' };
      if (typeof detail?.error === 'string' && Object.prototype.hasOwnProperty.call(knownErrors, detail.error)) error = knownErrors[detail.error];
      return { success: false, code: response.status === 409 ? 'conflict' : response.status >= 500 || [404, 405, 429].includes(response.status) ? 'unavailable' : 'access_denied', error };
    }
    const result = studioResponseSchema.parse(await readLearningResponse(response, 2 * 1024 * 1024));
    if (result.snapshot && (result.snapshot.session_id !== parsed.data.session_id || result.snapshot.user_id !== identity.userId)) throw new Error('Actor incompatible');
    if(result.recording_snapshot && (result.recording_snapshot.session_id!==parsed.data.session_id || result.recording_snapshot.user_id!==identity.userId))throw new Error('Archivo incompatible');
    if(result.playback){
      if(result.playback.session_id!==parsed.data.session_id || result.playback.user_id!==identity.userId || parsed.data.operation.type!=='recordings' || parsed.data.operation.operation.type!=='play' || result.playback.run_id!==parsed.data.operation.operation.run_id)throw new Error('Reproducción incompatible');
      for(const segment of result.playback.segments){const target=new URL(segment.url);if(target.protocol!=='https:'||!target.hostname.endsWith('.supabase.co')||!target.pathname.startsWith('/storage/v1/object/sign/live-recordings/')||target.username||target.password||target.port)throw new Error('Vídeo incompatible');}
    }
    if ((await deps.getIdentity())?.userId !== identity.userId) return { success: false, code: 'not_ready', error: 'La cuenta cambió durante la operación.' };
    if (result.upload) {
      const target = new URL(result.upload.url);
      if (target.protocol !== 'https:' || !target.hostname.endsWith('.supabase.co') || !target.pathname.startsWith('/storage/v1/object/upload/sign/live-studio-assets/') || target.username || target.password) throw new Error('Subida incompatible');
    }
    return { success: true, ...result };
  } catch { return { success: false, code: 'unavailable', error: 'No se pudo completar la operación del estudio.' }; }
}
