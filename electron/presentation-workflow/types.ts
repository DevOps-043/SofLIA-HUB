export type WorkflowState =
  | 'AWAITING_DATA'
  | 'PROCESSING_PROPOSAL'
  | 'AWAITING_APPROVAL'
  | 'GENERATING_PRESENTATION'
  | 'COMPLETED';

export interface PresentacionData {
  teamMode?: import('../../src/shared/agent-teams/policy').TeamMode;
  clientCompanyName?: string;
  clientEmail?: string;
  extractedText?: string;
  proposalContent?: string;
}
