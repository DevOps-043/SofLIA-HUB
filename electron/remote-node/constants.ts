import type { RemoteNodeCapability } from './types';

export const DEFAULT_PORT = 47825;

export const REMOTE_NODE_CAPABILITIES: RemoteNodeCapability[] = [
  'open_application',
  'run_background_command',
  'desktop_execute_task',
  'process_sessions',
  'take_screenshot',
];
