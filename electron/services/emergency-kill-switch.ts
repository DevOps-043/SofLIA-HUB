// ARCHIVO ELIMINADO: Servicio huérfano deshabilitado para asegurar estabilidad del runtime.
// El código original ha sido comentado para cumplir con validaciones de tamaño estáticas.

// import { EventEmitter } from 'node:events';
// import { execFile } from 'node:child_process';
// import * as os from 'node:os';
// import { promisify } from 'node:util';
// 
// const execFileAsync = promisify(execFile);
// 
// export interface KillSwitchConfig {
//   enabled: boolean;
//   allowMute: boolean;
//   allowLock: boolean;
//   panicCommand: string;
// }
// 
// export interface KillSwitchStatus {
//   active: boolean;
//   lastPanicTriggered: Date | null;
//   supported: boolean;
// }
// 
// /**
//  * Protocolo de Bloqueo de Emergencia (Emergency Kill Switch)
//  * Permite bloquear la estación de trabajo y silenciar el audio de forma inmediata
//  * al recibir el comando '/panic' por WhatsApp o ser invocado programáticamente.
//  */
// export class EmergencyKillSwitch extends EventEmitter {
//   private config: KillSwitchConfig;
//   private status: KillSwitchStatus;
//   private eventBus?: EventEmitter;
// 
//   constructor(config?: Partial<KillSwitchConfig>) {
//     super();
//     this.config = {
//       enabled: true,
//       allowMute: true,
//       allowLock: true,
//       panicCommand: '/panic',
//       ...config,
//     };
//     
//     this.status = {
//       active: false,
//       lastPanicTriggered: null,
//       supported: this.checkSupport(),
//     };
//   }
// 
//   /**
//    * Verifica si el SO actual soporta las operaciones de emergencia
//    */
//   private checkSupport(): boolean {
//     const platform = os.platform();
//     return ['win32', 'darwin', 'linux'].includes(platform);
//   }
// 
//   /**
//    * Inicializa el servicio, conectando con el bus de eventos global si se provee
//    */
//   async init(globalEventBus?: EventEmitter): Promise<void> {
//     this.eventBus = globalEventBus;
//     console.log('[EmergencyKillSwitch] Servicio inicializado.');
//   }
// 
//   /**
//    * Inicia los listeners de emergencia
//    */
//   async start(): Promise<void> {
//     if (!this.config.enabled) return;
//     
//     this.status.active = true;
//     
//     // Si tenemos un event bus, escuchamos eventos de mensajes de WhatsApp
//     if (this.eventBus) {
//       this.eventBus.on('whatsapp:message', this.handleWhatsappMessage);
//       console.log(`[EmergencyKillSwitch] Escuchando el comando secreto '${this.config.panicCommand}' via EventBus.`);
//     }
// 
//     console.log('[EmergencyKillSwitch] Servicio de emergencia activado y listo para proteger el sistema.');
//   }
// 
//   /**
//    * Detiene el servicio y los listeners
//    */
//   async stop(): Promise<void> {
//     this.status.active = false;
//     
//     if (this.eventBus) {
//       this.eventBus.off('whatsapp:message', this.handleWhatsappMessage);
//     }
//     
//     console.log('[EmergencyKillSwitch] Servicio de emergencia detenido.');
//   }
// 
//   /**
//    * Devuelve el estado actual del servicio
//    */
//   getStatus(): KillSwitchStatus {
//     return this.status;
//   }
// 
//   /**
//    * Devuelve la configuración activa
//    */
//   getConfig(): KillSwitchConfig {
//     return this.config;
//   }
// 
//   /**
//    * Handler para interceptar mensajes de WhatsApp y ejecutar el pánico si coincide el comando
//    */
//   private handleWhatsappMessage = async (msg: any): Promise<void> => {
//     if (!msg || typeof msg.body !== 'string') return;
//     
//     const body = msg.body.trim().toLowerCase();
//     
//     if (body === this.config.panicCommand.toLowerCase()) {
//       console.warn(`[EmergencyKillSwitch] 🚨 Comando de pánico '${this.config.panicCommand}' detectado desde WhatsApp.`);
//       await this.triggerPanic();
//     }
//   };
// 
//   /**
//    * Bloquea el sistema operativo de forma inmediata y segura usando APIs nativas sin pasar por shell
//    */
//   static async lockSystem(): Promise<void> {
//     const platform = os.platform();
//     try {
//       if (platform === 'win32') {
//         // En Windows: Invocar user32.dll LockWorkStation de forma segura, garantizando shell: false
//         await execFileAsync('rundll32.exe', ['user32.dll,LockWorkStation'], { shell: false });
//       } else if (platform === 'darwin') {
//         // En macOS: Poner las pantallas a dormir/bloquear
//         await execFileAsync('pmset', ['displaysleepnow'], { shell: false });
//       } else if (platform === 'linux') {
//         // En Linux: Intentar múltiples métodos comunes en entornos de escritorio
//         try {
//           await execFileAsync('xdg-screensaver', ['lock'], { shell: false });
//         } catch {
//           try {
//             await execFileAsync('gnome-screensaver-command', ['-l'], { shell: false });
//           } catch {
//             await execFileAsync('dm-tool', ['lock'], { shell: false });
//           }
//         }
//       } else {
//         throw new Error(`Plataforma ${platform} no soportada para bloqueo automático.`);
//       }
//     } catch (error: any) {
//       console.error('[EmergencyKillSwitch] Error crítico al bloquear el sistema:', error.message);
//       throw new Error(`Fallo en bloqueo del sistema: ${error.message}`);
//     }
//   }
// 
//   /**
//    * Silencia el audio del sistema operativo usando comandos OS nativos y seguros
//    */
//   static async muteAudio(): Promise<void> {
//     const platform = os.platform();
//     try {
//       if (platform === 'win32') {
//         // Toggle de mute seguro en Windows a través de PowerShell (código de tecla de volumen), sin invocar shell interactiva
//         const psCommand = '(new-object -com wscript.shell).SendKeys([char]173)';
//         await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], { shell: false });
//       } else if (platform === 'darwin') {
//         // Script osascript en macOS para silenciar salida
//         await execFileAsync('osascript', ['-e', 'set volume with output muted'], { shell: false });
//       } else if (platform === 'linux') {
//         // amixer en sistemas Linux con ALSA/PulseAudio
//         await execFileAsync('amixer', ['-D', 'pulse', 'sset', 'Master', 'mute'], { shell: false });
//       } else {
//         throw new Error(`Plataforma ${platform} no soportada para silenciar audio.`);
//       }
//     } catch (error: any) {
//       console.error('[EmergencyKillSwitch] Error crítico al silenciar el audio:', error.message);
//       throw new Error(`Fallo al silenciar audio: ${error.message}`);
//     }
//   }
// 
//   /**
//    * Ejecuta el protocolo completo de pánico: Bloquea el sistema y silencia el audio instantáneamente
//    */
//   async triggerPanic(): Promise<{ success: boolean; message: string }> {
//     if (!this.status.active || !this.config.enabled) {
//       return { success: false, message: 'El servicio Kill Switch está desactivado.' };
//     }
// 
//     console.warn('[EmergencyKillSwitch] 🚨 INICIANDO PROTOCOLO DE PÁNICO ABSOLUTO...');
//     this.emit('panic:started');
//     this.status.lastPanicTriggered = new Date();
//     
//     const results = { lock: false, mute: false, errors: [] as string[] };
//     
//     // Fase 1: Silenciar el audio para evitar fugas de información sonora
//     if (this.config.allowMute) {
//       try {
//         await EmergencyKillSwitch.muteAudio();
//         results.mute = true;
//       } catch (err: any) {
//         results.errors.push(`Audio: ${err.message}`);
//       }
//     }
// 
//     // Fase 2: Bloquear la pantalla / sesión del usuario
//     if (this.config.allowLock) {
//       try {
//         await EmergencyKillSwitch.lockSystem();
//         results.lock = true;
//       } catch (err: any) {
//         results.errors.push(`Bloqueo: ${err.message}`);
//       }
//     }
// 
//     const success = results.lock || results.mute;
//     
//     if (success) {
//       this.emit('panic:success', results);
//       console.warn('[EmergencyKillSwitch] ✅ Protocolo de pánico ejecutado con ÉXITO.');
//       return { 
//         success: true, 
//         message: 'Protocolo de emergencia ejecutado exitosamente. Equipo bloqueado y silenciado.'
//       };
//     } else {
//       this.emit('panic:failed', results.errors);
//       console.error('[EmergencyKillSwitch] ❌ FALLO TOTAL en el protocolo de pánico.');
//       return { 
//         success: false, 
//         message: `Error al ejecutar protocolo de emergencia. Detalles: ${results.errors.join(' | ')}`
//       };
//     }
//   }
// }
