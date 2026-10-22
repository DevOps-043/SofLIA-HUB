import { useEffect, useState } from 'react';
import {
  onMeetingDetected,
  removeMeetingListeners,
  type MeetingRunDetail,
  type MeetingRunSummary,
} from '../../../services/meeting-service';
import { DEFAULT_FORM } from './styles';
import { buildActionDrafts, patchActionDraft } from './state-builders';
import type { ActionDraft, CreateMode, MeetingOpsForm } from './types';
import { useMeetingOpsActions } from './useMeetingOpsActions';
import { useMeetingOpsLoaders } from './useMeetingOpsLoaders';

export function useMeetingOpsState({ userId, organizationId, accessUserIds }: { userId: string; organizationId?: string; accessUserIds?: string[] }) {
  const [mode, setMode] = useState<CreateMode>('manual');
  const [form, setForm] = useState<MeetingOpsForm>(DEFAULT_FORM);
  const [runs, setRuns] = useState<MeetingRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MeetingRunDetail | null>(null);
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const { loadInitialData, loadRunDetail } = useMeetingOpsLoaders({
    userId, accessUserIds, organizationId, selectedRunId, setLoading, setError, setRuns, setSelectedRunId, setDetail,
  });

  const actions = useMeetingOpsActions({
    userId, organizationId, mode, form, detail, actionDrafts, loadInitialData,
    setForm, setLoading, setError, setNotice, setSelectedRunId, setDetail,
  });

  useEffect(() => { void loadInitialData(); }, [userId, organizationId]);

  useEffect(() => {
    onMeetingDetected((event) => {
      const ownIds = accessUserIds?.length ? accessUserIds : [userId];
      if (!ownIds.includes(event.ownerUserId)) return;
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


  const currentAnalysis = detail?.latest_asset?.payload.analysis_result || null;

  function updateActionDraft(actionId: string, patch: Partial<ActionDraft>): void {
    setActionDrafts((current) => patchActionDraft(current, actionId, patch));
  }

  return {
    mode, setMode, form, setForm, runs, selectedRunId, setSelectedRunId, detail,
    actionDrafts, loading, error, setError, notice, setNotice,
    expandedAction, setExpandedAction, currentAnalysis,
    loadInitialData, ...actions, updateActionDraft,
  };
}
