export interface TaskPlan {
  goal: string;
  subGoals: string[];
  currentSubGoalIndex: number;
  estimatedSteps: number;
  replannedCount: number;
}

export interface StrategicPlan {
  goal: string;
  phases: TaskPhase[];
  currentPhaseIndex: number;
  totalEstimatedSteps: number;
}

export interface TaskPhase {
  name: string;
  description: string;
  successCriteria: string;
  subGoals: string[];
  currentSubGoalIndex: number;
  estimatedSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startStep?: number;
  endStep?: number;
}

export interface UIElement {
  id: number;
  name: string;
  controlType: string;
  boundingRect: { x: number; y: number; width: number; height: number };
  isEnabled: boolean;
  automationId?: string;
  value?: string;
}

export interface HistorySummary {
  fromStep: number;
  toStep: number;
  summary: string;
}
