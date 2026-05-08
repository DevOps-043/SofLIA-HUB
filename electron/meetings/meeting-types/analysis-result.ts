import type {
  MeetingAnalysisAgreementItem,
  MeetingAnalysisDecisionItem,
  MeetingAnalysisFollowUpRecommendation,
  MeetingAnalysisOpenQuestionItem,
  MeetingAnalysisRiskItem,
  MeetingAnalysisTaskItem,
  MeetingAnalysisUnresolvedItem,
} from './analysis-items';

export interface MeetingAnalysisAlternativeType {
  type: string;
  confidence: number;
  reason: string;
}

export interface MeetingAnalysisMeetingType {
  suggestedType: string;
  alternativeTypes: MeetingAnalysisAlternativeType[];
  confidence: number;
  reason: string;
}

export interface MeetingAnalysisDetectedContext {
  project?: string | null;
  team?: string | null;
  meetingObjective: string[];
  relevantSignals: string[];
}

export interface MeetingAnalysisStrategy {
  strategyId: string;
  strategyName: string;
  whyThisStrategy: string;
  extractionFocus: string[];
}

export interface MeetingAnalysisDestinationRecommendation {
  suggestedDestination: 'IRIS' | 'Project Hub' | 'Team' | 'Project' | 'None';
  confidence: number;
  reason: string;
}

export interface MeetingAnalysisMessageDraft {
  kind: 'team_summary' | 'follow_up' | 'owner_confirmation' | 'other';
  content: string;
  requiresApproval: boolean;
}

export interface MeetingAnalysisGovernance {
  autonomyLevelApplied: number;
  sensitiveActionsBlocked: string[];
  requiresHumanApproval: boolean;
  explanationVisible: boolean;
}

export interface MeetingAnalysisResult {
  meetingType: MeetingAnalysisMeetingType;
  detectedContext: MeetingAnalysisDetectedContext;
  analysisStrategy: MeetingAnalysisStrategy;
  executiveSummary: string;
  keyPoints: string[];
  decisions: MeetingAnalysisDecisionItem[];
  agreements: MeetingAnalysisAgreementItem[];
  tasks: MeetingAnalysisTaskItem[];
  risks: MeetingAnalysisRiskItem[];
  openQuestions: MeetingAnalysisOpenQuestionItem[];
  unresolvedItems: MeetingAnalysisUnresolvedItem[];
  followUpRecommendation: MeetingAnalysisFollowUpRecommendation;
  destinationRecommendation: MeetingAnalysisDestinationRecommendation;
  messageDrafts?: MeetingAnalysisMessageDraft[];
  governance: MeetingAnalysisGovernance;
}
