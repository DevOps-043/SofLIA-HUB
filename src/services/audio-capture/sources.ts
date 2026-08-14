/**
 * Adquisicion de audio compartida entre la transcripcion de reuniones y la
 * escucha puntual del chat.
 *
 * El problema dificil ya estaba resuelto en el pipeline de reuniones: loopback
 * de la salida del sistema en Windows/macOS, dispositivo monitor en Linux y
 * degradacion declarada cuando ninguna de las dos existe. Se extrae aqui para
 * que la escucha del chat no abra una segunda ruta de captura en paralelo.
 */

export type SystemAudioMode = 'loopback' | 'monitor-device' | 'unavailable';

export interface SystemAudioResult {
  stream: MediaStream | null;
  mode: SystemAudioMode;
  /** Causa legible cuando no hay audio de sistema disponible. */
  detail?: string;
}

/** Salida de audio del equipo: lo que el usuario esta escuchando. */
export async function acquireSystemAudioStream(): Promise<SystemAudioResult> {
  // 1) Loopback nativo (Windows/macOS): main ya instalo el display handler.
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    displayStream.getVideoTracks().forEach((track) => track.stop()); // solo interesa el audio
    if (displayStream.getAudioTracks().length > 0) {
      return { stream: displayStream, mode: 'loopback' };
    }
    displayStream.getTracks().forEach((track) => track.stop());
  } catch (err) {
    console.warn('[AudioCapture] Loopback via getDisplayMedia no disponible:', errorText(err));
  }

  // 2) Linux: dispositivo "monitor" de PulseAudio/PipeWire como entrada.
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const monitor = devices.find((device) => device.kind === 'audioinput' && /monitor/i.test(device.label));
    if (monitor) {
      const monitorStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: monitor.deviceId }, echoCancellation: false, noiseSuppression: false },
      });
      return { stream: monitorStream, mode: 'monitor-device' };
    }
  } catch (err) {
    console.warn('[AudioCapture] Dispositivo monitor no disponible:', errorText(err));
  }

  return {
    stream: null,
    mode: 'unavailable',
    detail: 'Esta plataforma no permite capturar la salida de audio del equipo.',
  };
}

export async function acquireMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

/** ¿El fallo viene de un permiso denegado por el sistema operativo? */
export function isPermissionDenied(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? '';
  return name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError';
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
