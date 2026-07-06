import type { DesktopAgentService } from './desktop-agent-service';
import { registerDesktopAgentCalibrationHandlers } from './desktop-agent-handlers/calibration-handlers';
import { registerDesktopAgentObservationHandlers } from './desktop-agent-handlers/observation-handlers';
import { registerDesktopAgentPrimitiveHandlers } from './desktop-agent-handlers/primitive-handlers';
import { registerDesktopAgentStatusHandlers } from './desktop-agent-handlers/status-handlers';
import { registerDesktopAgentTaskHandlers } from './desktop-agent-handlers/task-handlers';
import { registerDesktopAgentWindowHandlers } from './desktop-agent-handlers/window-handlers';

export function registerDesktopAgentHandlers(agentService: DesktopAgentService) {
  registerDesktopAgentTaskHandlers(agentService);
  registerDesktopAgentStatusHandlers(agentService);
  registerDesktopAgentObservationHandlers(agentService);
  registerDesktopAgentPrimitiveHandlers(agentService);
  registerDesktopAgentWindowHandlers(agentService);
  registerDesktopAgentCalibrationHandlers(agentService);
}
