import type { AgentLoopOptions, PendingConfirmation, ToolLoopTraceEntry } from './types';

export type AgentLoopRequest = {
  agent: any;
  conversations: Map<string, any[]>;
  pendingConfirmations: Map<string, PendingConfirmation>;
  requestConfirmation: (
    jid: string,
    senderNumber: string,
    toolName: string,
    description: string,
    args: Record<string, any>,
  ) => Promise<boolean>;
  jid: string;
  senderNumber: string;
  userMessage: string;
  isGroup: boolean;
  groupPassiveHistory: string;
  inlineMediaParts: Array<{ inlineData: { mimeType: string; data: string } }>;
  options: AgentLoopOptions;
};

export type AgentLoopState = AgentLoopRequest & {
  chatSession: any;
  response: any;
  sessionKey: string;
  historyCopy: any[];
  requirements: {
    local: boolean;
    visual: boolean;
    remote: boolean;
  };
  evidence: {
    local: boolean;
    visual: boolean;
    remote: boolean;
  };
  isActionRequest: boolean;
  toolLoopTrace: ToolLoopTraceEntry[];
  loopGuardInterventions: number;
};
