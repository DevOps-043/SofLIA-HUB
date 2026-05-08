export interface AutomationOpsPanelProps {
  userId: string;
}

export type TriagePresetId = 'today' | 'unread' | 'priority' | 'custom';

export type ActiveAutomationAction =
  | 'triage'
  | 'brief'
  | 'followup'
  | 'meeting'
  | 'drive'
  | 'chat'
  | 'desktop'
  | 'custom';

export interface BridgeAvailability {
  automation: boolean;
  telegram: boolean;
  remoteNode: boolean;
  gchat: boolean;
}

export interface RemoteImageState {
  nodeId: string;
  image: string;
  capturedAt: string;
}
