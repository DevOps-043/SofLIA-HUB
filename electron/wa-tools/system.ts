import { BACKGROUND_HOST_TOOLS } from './system/background-host';
import { DEVICE_CONTROL_TOOLS } from './system/device-control';
import { MANAGED_COMMAND_TOOLS } from './system/managed-commands';
import { POWER_TOOLS } from './system/power';
import { PROCESS_TOOLS } from './system/processes';
import { PROCESS_SESSION_TOOLS } from './system/process-sessions';

export const SYSTEM_TOOLS = [
  ...PROCESS_TOOLS,
  ...POWER_TOOLS,
  ...DEVICE_CONTROL_TOOLS,
  ...MANAGED_COMMAND_TOOLS,
  ...PROCESS_SESSION_TOOLS,
  ...BACKGROUND_HOST_TOOLS,
];
