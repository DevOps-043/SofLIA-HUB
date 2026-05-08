import { z } from 'zod';
import {
  runLockScreen,
  runMuteVolume,
  runSleep,
} from './workstation-security/actions';
import { getWorkstationHealth } from './workstation-security/health';

export class WorkstationController {
  async lockScreen(): Promise<void> {
    return runLockScreen();
  }

  async sleep(): Promise<void> {
    return runSleep();
  }

  async muteVolume(): Promise<void> {
    return runMuteVolume();
  }

  async getHealth(): Promise<Record<string, any>> {
    return getWorkstationHealth();
  }
}

export const workstationControlSchema = z.object({
  action: z.enum(['lock', 'sleep', 'mute', 'health']).describe(
    'La accion a ejecutar: lock, sleep, mute o health.',
  ),
});

export const workstation_control = {
  name: 'workstation_control',
  description: 'Controla remotamente la estacion de trabajo y obtiene metricas de salud.',
  parameters: workstationControlSchema,
  execute: async (args: z.infer<typeof workstationControlSchema>) => {
    const controller = new WorkstationController();

    try {
      switch (args.action) {
        case 'lock':
          await controller.lockScreen();
          return { success: true, message: 'La pantalla ha sido bloqueada exitosamente.' };
        case 'sleep':
          await controller.sleep();
          return { success: true, message: 'El equipo ha sido puesto en modo suspension.' };
        case 'mute':
          await controller.muteVolume();
          return { success: true, message: 'El volumen del sistema ha sido silenciado o alternado.' };
        case 'health':
          return { success: true, data: await controller.getHealth() };
        default:
          return { success: false, error: `Accion no soportada: ${args.action}` };
      }
    } catch (error: any) {
      return { success: false, error: `Error al ejecutar la accion '${args.action}': ${error.message}` };
    }
  },
};
