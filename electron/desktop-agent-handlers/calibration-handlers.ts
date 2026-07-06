import { ipcMain, screen as electronScreen } from 'electron';
import type { DesktopAgentService } from '../desktop-agent-service';
import {
  buildCursorRoundtripMover,
  runCoordinateSelfTest,
  type CalibrationReport,
} from '../desktop-agent/coordinate-selftest';
import { getErrorMessage } from './errors';

const DISPLAY_CHANGE_DEBOUNCE_MS = 5000;

function runCalibration(agentService: DesktopAgentService): Promise<CalibrationReport> {
  return runCoordinateSelfTest({
    config: agentService.config,
    moveCursorAndRead: buildCursorRoundtripMover((script, timeout) => agentService.psEncoded(script, timeout)),
  });
}

export function registerDesktopAgentCalibrationHandlers(agentService: DesktopAgentService) {
  ipcMain.handle('desktop-agent:run-calibration', async () => {
    try {
      const report = await runCalibration(agentService);
      return { success: report.ok, report };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Al cambiar la topologia (conectar/desconectar monitor, cambiar DPI) se
  // valida el pipeline en segundo plano; un fallo solo advierte en el log,
  // nunca bloquea al agente.
  let debounceTimer: NodeJS.Timeout | null = null;
  try {
    electronScreen.on('display-metrics-changed', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (agentService.activeTasks.size > 0) return; // no mover el cursor durante una tarea
        runCalibration(agentService)
          .then((report) => {
            if (!report.ok) {
              console.warn('[DesktopAgent] ADVERTENCIA: la calibracion de coordenadas fallo tras el cambio de monitores. Revisa desktop-agent:run-calibration.');
            }
          })
          .catch((error) => {
            console.warn('[DesktopAgent] Calibracion automatica fallo:', getErrorMessage(error));
          });
      }, DISPLAY_CHANGE_DEBOUNCE_MS);
    });
  } catch (error) {
    console.warn('[DesktopAgent] No se pudo suscribir a display-metrics-changed:', getErrorMessage(error));
  }
}
