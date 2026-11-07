import type { DesktopAgentService } from './desktop-agent-service';
import type { BrowserWindow } from 'electron';
import { desktopRegistration } from './desktop-agent-handlers/authorized-registration';
import { registerDesktopAgentCalibrationHandlers } from './desktop-agent-handlers/calibration-handlers';
import { registerDesktopAgentObservationHandlers } from './desktop-agent-handlers/observation-handlers';
import { registerDesktopAgentPrimitiveHandlers } from './desktop-agent-handlers/primitive-handlers';
import { registerDesktopAgentStatusHandlers } from './desktop-agent-handlers/status-handlers';
import { registerDesktopAgentTaskHandlers } from './desktop-agent-handlers/task-handlers';
import { registerDesktopAgentWindowHandlers } from './desktop-agent-handlers/window-handlers';

export function registerDesktopAgentHandlers(agentService: DesktopAgentService, getMainWindow: () => BrowserWindow | null = () => null, getOrbWindow: () => BrowserWindow | null = () => null) {
  const register = desktopRegistration(() => [getMainWindow(), getOrbWindow()]);
  const stopObservation = registerDesktopAgentObservationHandlers(agentService, register);
  registerDesktopAgentTaskHandlers(agentService, register, stopObservation);
  registerDesktopAgentStatusHandlers(agentService, register);
  registerDesktopAgentPrimitiveHandlers(agentService, register);
  registerDesktopAgentWindowHandlers(agentService, register);
  registerDesktopAgentCalibrationHandlers(agentService, register);
}
