import { useEffect, useMemo, useState } from 'react';
import {
  onMeetingDetected,
  removeMeetingListeners,
  type MeetingContextProject,
  type MeetingContextTeam,
  type MeetingContextTeamMember,
  type MeetingRunDetail,
  type MeetingRunSummary,
} from '../../../services/meeting-service';
import { DEFAULT_FORM } from './styles';
import { buildActionDrafts, filterMembersByTeam, filterProjectsByTeam, patchActionDraft } from './state-builders';
import type { ActionDraft, CreateMode, MeetingOpsForm } from './types';
import { useMeetingOpsActions } from './useMeetingOpsActions';
import { useMeetingOpsLoaders } from './useMeetingOpsLoaders';

export function useMeetingOpsState({ userId, organizationId }: { userId: string; organizationId?: string }) {
  const [mode, setMode] = useState<CreateMode>('manual');
  const [form, setForm] = useState<MeetingOpsForm>(DEFAULT_FORM);
  const [runs, setRuns] = useState<MeetingRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MeetingRunDetail | null>(null);
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({});
  const [teams, setTeams] = useState<MeetingContextTeam[]>([]);
  const [projects, setProjects] = useState<MeetingContextProject[]>([]);
  const [teamMembers, setTeamMembers] = useState<MeetingContextTeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const { loadInitialData, loadRunDetail } = useMeetingOpsLoaders({
    userId, selectedRunId, setLoading, setError, setRuns, setTeams,
    setProjects, setTeamMembers, setSelectedRunId, setDetail,
  });

  const actions = useMeetingOpsActions({
    userId, organizationId, mode, form, detail, actionDrafts, loadInitialData,
    setForm, setLoading, setError, setNotice, setSelectedRunId, setDetail,
  });

  useEffect(() => { void loadInitialData(); }, [userId]);

  useEffect(() => {
    onMeetingDetected((event) => {
      if (event.ownerUserId !== userId) return;
      setNotice(`Nueva reunion detectada: ${event.meetingTitle || event.sourceFileName || 'Sin titulo'}.`);
      setSelectedRunId(event.runId);
      void loadInitialData();
      void loadRunDetail(event.runId);
    });
    return () => { removeMeetingListeners(); };
  }, [userId]);

  useEffect(() => {
    if (!selectedRunId) return;
    void loadRunDetail(selectedRunId);
  }, [selectedRunId]);

  useEffect(() => {
    setActionDrafts(buildActionDrafts(detail));
  }, [detail]);

  const visibleProjects = useMemo(() => {
    if (!form.defaultTeamId) return projects;
    return filterProjectsByTeam(projects, form.defaultTeamId);
  }, [projects, form.defaultTeamId]);

  const currentAnalysis = detail?.latest_asset?.payload.analysis_result || null;

  function updateActionDraft(actionId: string, patch: Partial<ActionDraft>): void {
    setActionDrafts((current) => patchActionDraft(current, actionId, patch));
  }

  function getProjectsForTeam(teamId: string): MeetingContextProject[] {
    return filterProjectsByTeam(projects, teamId);
  }

  function getMembersForTeam(teamId: string): MeetingContextTeamMember[] {
    return filterMembersByTeam(teamMembers, teamId);
  }

  return {
    mode, setMode, form, setForm, runs, selectedRunId, setSelectedRunId, detail,
    actionDrafts, teams, projects, teamMembers, loading, error, setError, notice, setNotice,
    expandedAction, setExpandedAction, visibleProjects, currentAnalysis,
    loadInitialData, ...actions, updateActionDraft,
    getProjectsForTeam, getMembersForTeam,
  };
}
