import { ipcMain, screen as electronScreen } from 'electron';
import type { DesktopAgentService } from '../desktop-agent-service';
import {
  buildCursorRoundtripMover,
  runCoordinateSelfTest,
  type CalibrationReport,
} from '../desktop-agent/coordinate-selftest';
import { getErrorMessage } from './errors';

const DISPLAY_CHANGE_DEBOUNCE_MS = 5000;

/** Diagnostico completo: mueve el mouse fisico. Solo a peticion explicita. */
function runCursorCalibration(agentService: DesktopAgentService): Promise<CalibrationReport> {
  return runCoordinateSelfTest({
    config: agentService.config,
    moveCursorAndRead: buildCursorRoundtripMover((script, timeout) => agentService.psEncoded(script, timeout)),
  });
}

/** Revalidacion en segundo plano: solo aritmetica, jamas toca el puntero. */
function runPassiveCalibration(agentService: DesktopAgentService): Promise<CalibrationReport> {
  return runCoordinateSelfTest({ config: agentService.config });
}

export function registerDesktopAgentCalibrationHandlers(agentService: DesktopAgentService) {
  ipcMain.handle('desktop-agent:run-calibration', async () => {
    // El round-trip toma el control del puntero: pelearselo a una tarea en
    // curso arruinaria la tarea y el diagnostico.
    if (agentService.activeTasks.size > 0) {
      return { success: false, error: 'Hay una tarea del agente en curso. La calibracion mueve el mouse: reintenta al terminar.' };
    }
    try {
      const report = await runCursorCalibration(agentService);
      return { success: report.ok, report };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Al cambiar la topologia (conectar/desconectar monitor, cambiar DPI) se
  // revalida el pipeline en segundo plano. Es deliberadamente PASIVO: este
  // evento tambien se dispara durante el arranque de la app, y mover el mouse
  // del usuario sin que lo pida es inaceptable. El round-trip con cursor real
  // vive solo en desktop-agent:run-calibration.
  let debounceTimer: NodeJS.Timeout | null = null;
  try {
    electronScreen.on('display-metrics-changed', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runPassiveCalibration(agentService)
          .then((report) => {
            if (!report.ok) {
              console.warn('[DesktopAgent] ADVERTENCIA: el mapeo de coordenadas fallo tras el cambio de monitores. Ejecuta desktop-agent:run-calibration para el diagnostico completo.');
            }
          })
          .catch((error) => {
            console.warn('[DesktopAgent] Revalidacion de coordenadas fallo:', getErrorMessage(error));
          });
      }, DISPLAY_CHANGE_DEBOUNCE_MS);
    });
  } catch (error) {
    console.warn('[DesktopAgent] No se pudo suscribir a display-metrics-changed:', getErrorMessage(error));
  }
}
