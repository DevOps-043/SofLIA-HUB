export type WorkflowState =
  | 'AWAITING_DATA'
  | 'PROCESSING_PROPOSAL'
  | 'AWAITING_APPROVAL'
  | 'GENERATING_PRESENTATION'
  | 'COMPLETED';

export interface PresentacionData {
  clientCompanyName?: string;
  clientEmail?: string;
  extractedText?: string;
  proposalContent?: string;
}
