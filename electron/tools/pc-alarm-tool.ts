import { z } from 'zod';
import { PcAlarmService } from '../services/pc-alarm-service';

/**
 * Instancia global del servicio de alarmas para la herramienta.
 * Mantiene el estado de las alarmas (temporizadores activos) en memoria
 * mientras el proceso de Node (Electron Main) siga vivo.
 */
const alarmService = new PcAlarmService();

// Inicializamos el servicio inmediatamente y lo iniciamos para recibir llamadas
alarmService.init()
  .then(() => alarmService.start())
  .catch((err: any) => console.error('[PcAlarmTool] Error al inicializar el servicio:', err));

// Esquema Zod (usando 'any' explícito para evitar TS2345 al registrar la herramienta)
const alarmSchema: any = z.object({
  action: z.enum(['set', 'cancel', 'status']).describe('Acción a realizar: set (crear), cancel (borrar), status (ver activas)'),
  minutes: z.number().optional().describe('Tiempo en minutos antes de que suene (requerido para set)'),
  message: z.string().optional().describe('Mensaje de la alarma que se mostrará en pantalla (para set)'),
  id: z.string().optional().describe('ID personalizado para la alarma (requerido para cancel)')
});

/**
 * Herramienta: PC Alarm
 * Exposición del servicio de Alarmas de PC para el Agente Autónomo.
 * Permite al agente programar alarmas físicas (sonido y notificación de SO)
 * en la computadora donde se ejecuta SofLIA, ideal para técnicas Pomodoro
 * o recordatorios inmediatos al usuario.
 */
export const pcAlarmTool = {
  name: 'pc_alarm',
  description: 'Programa una alarma física o temporizador Pomodoro directamente en los altavoces y pantalla de la computadora del usuario.',
  schema: alarmSchema,
  handler: async (input: any) => {
    try {
      const action = input.action;

      if (action === 'set') {
        const minutes = input.minutes;
        if (typeof minutes !== 'number' || minutes <= 0) {
          throw new Error('La acción "set" requiere la propiedad "minutes" con un número mayor a 0.');
        }

        const message = input.message || 'Alarma de SofLIA';
        
        // Se puede proveer un ID personalizado, si no el servicio genera un UUID
        const customId = input.id;
        const id = alarmService.setAlarm(minutes, message, customId);
        
        return `✅ Alarma programada con éxito en la computadora local.\nID: ${id}\nMensaje: "${message}"\nTiempo: Sonará físicamente dentro de ${minutes} minuto(s).`;
      } 
      
      else if (action === 'cancel') {
        const idToCancel = input.id;
        if (!idToCancel) {
          throw new Error('La acción "cancel" requiere la propiedad "id" para identificar qué alarma cancelar.');
        }

        const success = alarmService.cancelAlarm(idToCancel);
        if (success) {
          return `✅ Alarma con ID [${idToCancel}] ha sido cancelada exitosamente y no sonará.`;
        } else {
          return `⚠️ No se pudo cancelar. Es posible que el ID [${idToCancel}] no exista o que la alarma ya haya sonado.`;
        }
      } 
      
      else if (action === 'status') {
        const status = alarmService.getStatus();
        
        if (status.activeAlarms === 0) {
          return 'ℹ️ No hay alarmas programadas en la computadora en este momento.';
        }

        const alarmsList = status.alarms.map(a => {
          const remainingMs = a.triggerTime - Date.now();
          const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
          return `- ID: ${a.id} | Mensaje: "${a.message}" | Sonará en aprox: ${remainingMin} minuto(s)`;
        }).join('\n');

        return `📊 Estado de Alarmas del PC:\nTotal activas: ${status.activeAlarms}\n\nLista de alarmas:\n${alarmsList}`;
      } 
      
      else {
        throw new Error(`Acción desconocida: "${action}". Valores permitidos: 'set', 'cancel', 'status'.`);
      }
    } catch (error: any) {
      return `❌ Error al ejecutar pc_alarm: ${error.message}`;
    }
  }
};
