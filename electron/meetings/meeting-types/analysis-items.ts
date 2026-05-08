export interface MeetingAnalysisDecisionItem {
  description: string;
  confidence: number;
  evidence?: string[];
}

export interface MeetingAnalysisAgreementItem {
  description: string;
  confidence: number;
  evidence?: string[];
}

export interface MeetingAnalysisTaskItem {
  description: string;
  ownerSuggested?: string | null;
  ownerConfidence?: number | null;
  dueDateSuggested?: string | null;
  prioritySuggested?: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  confidence: number;
  requiresHumanReview: boolean;
  evidence?: string[];
}

export interface MeetingAnalysisRiskItem {
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reason?: string;
}

export interface MeetingAnalysisOpenQuestionItem {
  question: string;
  confidence: number;
}

export interface MeetingAnalysisUnresolvedItem {
  item: string;
  reasonOpen: string;
  confidence: number;
}

export interface MeetingAnalysisFollowUpRecommendation {
  suggested: boolean;
  type?: 'meeting' | 'message' | 'validation' | 'reminder' | 'escalation';
  description?: string;
  confidence: number;
  reason: string;
}
