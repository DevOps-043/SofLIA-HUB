import type { Dispatch, SetStateAction } from 'react';
import {
  getMeetingContext,
  getMeetingRunDetail,
  listMeetingRuns,
  type MeetingContextProject,
  type MeetingContextTeam,
  type MeetingContextTeamMember,
  type MeetingRunDetail,
  type MeetingRunSummary,
} from '../../../services/meeting-service';

interface LoaderConfig {
  userId: string;
  selectedRunId: string | null;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setRuns: Dispatch<SetStateAction<MeetingRunSummary[]>>;
  setTeams: Dispatch<SetStateAction<MeetingContextTeam[]>>;
  setProjects: Dispatch<SetStateAction<MeetingContextProject[]>>;
  setTeamMembers: Dispatch<SetStateAction<MeetingContextTeamMember[]>>;
  setSelectedRunId: Dispatch<SetStateAction<string | null>>;
  setDetail: Dispatch<SetStateAction<MeetingRunDetail | null>>;
}

export function useMeetingOpsLoaders(config: LoaderConfig) {
  async function loadInitialData(): Promise<void> {
    config.setLoading(true);
    config.setError(null);
    try {
      const [runsResult, contextResult] = await Promise.all([
        listMeetingRuns({ ownerUserId: config.userId, limit: 20 }),
        getMeetingContext(),
      ]);
      if (!runsResult.success) throw new Error(runsResult.error || 'No pude cargar los runs.');
      if (!contextResult.success) throw new Error(contextResult.error || 'No pude cargar el contexto de IRIS.');

      const nextRuns = runsResult.runs || [];
      config.setRuns(nextRuns);
      config.setTeams(contextResult.teams || []);
      config.setProjects(contextResult.projects || []);
      config.setTeamMembers(contextResult.teamMembers || []);
      if (!config.selectedRunId && nextRuns.length > 0) config.setSelectedRunId(nextRuns[0].run.id);
    } catch (err: any) {
      config.setError(err?.message || 'No pude cargar Meeting Ops.');
    } finally {
      config.setLoading(false);
    }
  }

  async function loadRunDetail(runId: string): Promise<void> {
    config.setError(null);
    const result = await getMeetingRunDetail(runId);
    if (!result.success || !result.detail) {
      config.setError(result.error || 'No pude cargar el detalle.');
      return;
    }
    config.setDetail(result.detail);
  }

  return { loadInitialData, loadRunDetail };
}
