import { useMemo } from 'react';
import { isAutomationAvailable } from '../../../services/automation-service';
import { isGChatAvailable } from '../../../services/gchat-service';
import { isRemoteNodeAvailable } from '../../../services/remote-node-service';
import { isTelegramAvailable } from '../../../services/telegram-service';
import type { BridgeAvailability } from './types';

export function useBridgeAvailability(): BridgeAvailability {
  return useMemo(() => ({
    automation: isAutomationAvailable(),
    telegram: isTelegramAvailable(),
    remoteNode: isRemoteNodeAvailable(),
    gchat: isGChatAvailable(),
  }), []);
}
