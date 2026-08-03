import { getSupabaseConfigDiagnostics } from '../../lib/supabase';

export function buildLiaStatusMessage(error: unknown): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : String(error || '');

  if (/email not confirmed/i.test(rawMessage)) {
    return 'La cuenta de Lia requiere confirmar el correo para poder sincronizar conversaciones.';
  }

  if (/user already registered/i.test(rawMessage)) {
    return 'La cuenta de Lia ya existe, pero esta sesion no pudo abrirla. Cierra sesion e inicia de nuevo para reintentar la sincronizacion.';
  }

  if (/invalid login credentials/i.test(rawMessage)) {
    return 'No se pudo abrir la sesion de Lia con estas credenciales. Cierra sesion e inicia nuevamente para restaurar la sincronizacion.';
  }

  if (/invalid api key/i.test(rawMessage)) {
    const diagnostics = getSupabaseConfigDiagnostics();

    if (diagnostics.runtime && diagnostics.runtime.configError === null && diagnostics.renderer.configError !== null) {
      return 'Lia si esta configurado en runtime, pero esta ventana se inicio con una configuracion vieja o incompleta. Reinicia Pulse para reconstruir el frontend con la clave correcta.';
    }

    if (
      diagnostics.runtime &&
      diagnostics.renderer.projectRef &&
      diagnostics.runtime.projectRef &&
      diagnostics.renderer.projectRef !== diagnostics.runtime.projectRef
    ) {
      return `El frontend apunta a un proyecto de Lia distinto (${diagnostics.renderer.projectRef}) al que cargo Electron (${diagnostics.runtime.projectRef}). Reinicia Pulse para alinear la sincronizacion de chats.`;
    }

    if (diagnostics.effective.configError) {
      return `La configuracion de Lia en esta app no es valida: ${diagnostics.effective.configError}. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y reinicia Pulse.`;
    }

    if (diagnostics.effective.source === 'runtime_env') {
      return 'Supabase rechazo la clave anonima de Lia cargada en runtime para este dispositivo. Verifica que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY pertenezcan al mismo proyecto.';
    }

    return 'Supabase rechazo la clave anonima de Lia que trae este frontend. Reinicia Pulse o vuelve a compilar la app para cargar la configuracion correcta.';
  }

  if (rawMessage && rawMessage !== 'null' && rawMessage !== 'undefined') {
    return `No se pudo activar la sincronizacion con Lia: ${rawMessage}`;
  }

  return 'No se pudo activar la sincronizacion con Lia en este dispositivo.';
}
