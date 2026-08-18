export interface RoadmapGoal {
  id: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: string;
  completedAt?: string;
}

export interface CapabilityEntry {
  feature: string;
  status: 'functional' | 'partial' | 'broken' | 'missing';
}

export interface Retrospective {
  runId: string;
  impactScore: number;
  lessonsLearned: string[];
  mistakes: string[];
  filesTouched: string[];
}

export interface StrategicMemory {
  roadmap: RoadmapGoal[];
  capabilities: CapabilityEntry[];
  retrospectives: Retrospective[];
  userPatterns: Array<{ description: string; frequency: number; type: 'complaint' | 'suggestion' }>;
  rejectedIdeas: Array<{ idea: string; reason: string }>;
  hotspots: Record<string, number>;
}

export function createEmptyMemory(): StrategicMemory {
  return { roadmap: [], capabilities: [], retrospectives: [], userPatterns: [], rejectedIdeas: [], hotspots: {} };
}

export function selectStrategy(memory: StrategicMemory): string {
  if (memory.userPatterns.some((pattern) => pattern.type === 'complaint' && pattern.frequency > 0)) return 'user-driven';
  if (memory.capabilities.some((capability) => capability.status === 'missing' || capability.status === 'broken')) return 'gap-filling';
  const recentRetros = memory.retrospectives.slice(-3);
  const avgImpact = recentRetros.length > 0
    ? recentRetros.reduce((sum, retro) => sum + retro.impactScore, 0) / recentRetros.length
    : 3;
  if (avgImpact < 2.5) return 'innovation';
  if (memory.roadmap.some((goal) => (goal.priority === 'critical' || goal.priority === 'high') && goal.status === 'pending')) return 'deep-improvement';
  return 'deep-improvement';
}
