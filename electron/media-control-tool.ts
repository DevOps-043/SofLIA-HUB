import { exec } from 'child_process';
import { promisify } from 'util';

// 1. Importar { exec } de 'child_process' y promisify de 'util'.
const execAsync = promisify(exec);

// 2. Definir tipos de acción soportados
/**
 * Tipo de acción multimedia que puede ser controlada de forma remota.
 * - play_pause: Alterna entre reproducción y pausa.
 * - next: Avanza a la siguiente pista.
 * - prev: Retrocede a la pista anterior.
 * - vol_up: Sube el volumen general del sistema.
 * - vol_down: Baja el volumen general del sistema.
 * - mute: Alterna el estado de silencio del sistema.
 */
export type MediaAction = 'play_pause' | 'next' | 'prev' | 'vol_up' | 'vol_down' | 'mute';

// 3. Crear diccionarios de KeyCodes para Windows
/**
 * Diccionario de Virtual Key Codes para Windows
 * Estos códigos simulan las teclas multimedia nativas del teclado.
 * Referencia oficial: https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
 */
const winKeyCodes: Record<MediaAction, number> = {
  play_pause: 179, // VK_MEDIA_PLAY_PAUSE (0xB3)
  next: 176,       // VK_MEDIA_NEXT_TRACK (0xB0)
  prev: 177,       // VK_MEDIA_PREV_TRACK (0xB1)
  vol_up: 175,     // VK_VOLUME_UP (0xAF)
  vol_down: 174,   // VK_VOLUME_DOWN (0xAE)
  mute: 173        // VK_VOLUME_MUTE (0xAD)
};

// 4. Crear diccionarios de KeyCodes para Mac (System Events)
/**
 * Diccionario de Hardware Key Codes para macOS
 * Estos códigos son los interpretados por System Events cuando se envían eventos nativos.
 */
const macKeyCodes: Record<MediaAction, number> = {
  play_pause: 100, // F8 / Media Play Pause
  next: 101,       // F9 / Media Next
  prev: 98,        // F7 / Media Previous
  vol_up: 72,      // Volume Up
  vol_down: 73,    // Volume Down
  mute: 74         // Mute Toggle
};

/**
 * Diccionario auxiliar para proveer respuestas amigables y descriptivas
 * sobre la acción ejecutada, lo cual mejora la retroalimentación del LLM y del usuario.
 */
const actionDescriptions: Record<MediaAction, string> = {
  play_pause: 'Reproducir / Pausar',
  next: 'Siguiente Pista',
  prev: 'Pista Anterior',
  vol_up: 'Subir Volumen',
  vol_down: 'Bajar Volumen',
  mute: 'Silenciar / Activar Sonido'
};

// 5. Implementar async function controlMedia(action)
/**
 * Herramienta nativa de Control Multimedia Remoto para SofLIA.
 * 
 * Permite al usuario (a través de WhatsApp o AutoDev) controlar la música, videos
 * y el nivel de audio del sistema de forma completamente remota sin depender de 
 * librerías externas o software de terceros.
 * 
 * @param action - La acción específica a ejecutar ('play_pause', 'next', 'prev', etc.)
 * @returns Promesa que resuelve a un string descriptivo sobre el resultado de la operación.
 */
export async function controlMedia(action: MediaAction): Promise<string> {
  const platform = process.platform;
  const actionDesc = actionDescriptions[action] || action;
  let command = '';

  try {
    // Usa un switch sobre process.platform
    switch (platform) {
      case 'win32': {
        const keyCode = winKeyCodes[action];
        if (keyCode === undefined) {
          throw new Error(`Código de tecla no encontrado para la acción '${action}' en Windows.`);
        }
        
        // 6. Si es win32: ejecuta powershell con WScript.Shell
        // Es un método integrado de Windows para emitir pulsaciones de teclado a nivel sistema
        command = `powershell.exe -command "(New-Object -ComObject wscript.shell).SendKeys([char]${keyCode})"`;
        await execAsync(command);
        break;
      }
      
      case 'darwin': {
        const keyCode = macKeyCodes[action];
        if (keyCode === undefined) {
          throw new Error(`Código de tecla no encontrado para la acción '${action}' en macOS.`);
        }
        
        // 7. Si es darwin: ejecuta osascript delegando en System Events
        command = `osascript -e 'tell application "System Events" to key code ${keyCode}'`;
        await execAsync(command);
        break;
      }

      case 'linux': {
        // Soporte adicional preventivo para Linux. 
        // Emplea 'playerctl' que es el estándar para control de interfaces MPRIS (Spotify, VLC, Chrome)
        // Y 'amixer' para control de ALSA / PulseAudio.
        if (action === 'play_pause' || action === 'next' || action === 'prev') {
          const cmdMap = { play_pause: 'play-pause', next: 'next', prev: 'previous' };
          command = `playerctl ${cmdMap[action as keyof typeof cmdMap]}`;
        } else {
          const volMap = {
            vol_up: 'amixer -q sset Master 5%+',
            vol_down: 'amixer -q sset Master 5%-',
            mute: 'amixer -q sset Master toggle'
          };
          command = volMap[action as keyof typeof volMap];
        }
        
        try {
          await execAsync(command);
        } catch (linuxErr: any) {
          throw new Error(`Dependencias faltantes en Linux. Instala 'playerctl' o 'alsa-utils'. Detalle: ${linuxErr.message}`);
        }
        break;
      }

      default:
        throw new Error(`Plataforma '${platform}' no soportada por el sistema de control multimedia.`);
    }

    // 8. Retornar mensaje de éxito descriptivo para el LLM.
    return `✅ [MediaControl] La acción de control multimedia '${actionDesc}' se ha ejecutado exitosamente en el sistema anfitrión (${platform}).`;

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[MediaControlTool] Falló la ejecución de la acción multimedia (${action}):`, errorMsg);
    
    // Devolvemos el error en formato texto en lugar de arrojar una excepción 
    // para que el LLM del agente reciba la respuesta como texto y pueda actuar en consecuencia.
    return `❌ [MediaControl] Error crítico al intentar ejecutar '${actionDesc}': ${errorMsg}`;
  }
}

/**
 * Declaración exportable de la Herramienta para ser registrada en el agente (WhatsApp o AutoDev).
 * Sigue la estructura estándar de SchemaType.OBJECT requerida por el core del sistema.
 */
export const MEDIA_CONTROL_TOOL_DECLARATION = {
  name: 'control_media_system',
  description: 'Controla remotamente la reproducción multimedia (música/videos en Spotify, YouTube, etc.) y el nivel de volumen general del sistema host.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: {
        type: 'STRING',
        description: 'Tipo de acción multimedia a ejecutar. Valores permitidos: "play_pause", "next", "prev", "vol_up", "vol_down", "mute"',
        enum: ['play_pause', 'next', 'prev', 'vol_up', 'vol_down', 'mute']
      }
    },
    required: ['action']
  }
};
