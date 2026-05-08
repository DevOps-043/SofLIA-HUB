export interface MeetingAnalysisResult {
  meetingType: {
    suggestedType: string;
    alternativeTypes: Array<{ type: string; confidence: number; reason: string }>;
    confidence: number;
    reason: string;
  };
  detectedContext: {
    project?: string | null;
    team?: string | null;
    meetingObjective: string[];
    relevantSignals: string[];
  };
  analysisStrategy: {
    strategyId: string;
    strategyName: string;
    whyThisStrategy: string;
    extractionFocus: string[];
  };
  executiveSummary: string;
  keyPoints: string[];
  decisions: Array<{ description: string; confidence: number; evidence?: string[] }>;
  agreements: Array<{ description: string; confidence: number; evidence?: string[] }>;
  tasks: Array<{
    description: string;
    ownerSuggested?: string | null;
    ownerConfidence?: number | null;
    dueDateSuggested?: string | null;
    prioritySuggested?: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    confidence: number;
    requiresHumanReview: boolean;
    evidence?: string[];
  }>;
  risks: Array<{ description: string; severity?: 'low' | 'medium' | 'high' | 'critical'; confidence: number; reason?: string }>;
  openQuestions: Array<{ question: string; confidence: number }>;
  unresolvedItems: Array<{ item: string; reasonOpen: string; confidence: number }>;
  followUpRecommendation: {
    suggested: boolean;
    type?: 'meeting' | 'message' | 'validation' | 'reminder' | 'escalation';
    description?: string;
    confidence: number;
    reason: string;
  };
  destinationRecommendation: {
    suggestedDestination: 'IRIS' | 'Project Hub' | 'Team' | 'Project' | 'None';
    confidence: number;
    reason: string;
  };
  messageDrafts?: Array<{
    kind: 'team_summary' | 'follow_up' | 'owner_confirmation' | 'other';
    content: string;
    requiresApproval: boolean;
  }>;
  governance: {
    autonomyLevelApplied: number;
    sensitiveActionsBlocked: string[];
    requiresHumanApproval: boolean;
    explanationVisible: boolean;
  };
}
