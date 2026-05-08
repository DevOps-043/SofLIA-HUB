import { CreateRunForm } from './meeting-ops-panel/CreateRunForm';
import { PanelHeader } from './meeting-ops-panel/PanelHeader';
import { RunDetailPanel } from './meeting-ops-panel/RunDetailPanel';
import { RunsList } from './meeting-ops-panel/RunsList';
import type { MeetingOpsPanelProps } from './meeting-ops-panel/types';
import { useMeetingOpsState } from './meeting-ops-panel/useMeetingOpsState';

export function MeetingOpsPanel({ userId, organizationId }: MeetingOpsPanelProps) {
  const state = useMeetingOpsState({ userId, organizationId: organizationId ?? undefined });
  const inputClass = 'w-full rounded-lg border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition';
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PanelHeader
        error={state.error}
        loading={state.loading}
        notice={state.notice}
        onReload={() => void state.loadInitialData()}
        setError={state.setError}
        setNotice={state.setNotice}
      />
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <CreateRunForm
          form={state.form}
          handleCreateRun={state.handleCreateRun}
          inputClass={inputClass}
          loading={state.loading}
          mode={state.mode}
          selectClass={selectClass}
          setForm={state.setForm}
          setMode={state.setMode}
          teams={state.teams}
          visibleProjects={state.visibleProjects}
        />
        <section className="px-6 pb-6 border-t border-gray-200 dark:border-white/[0.05] pt-5">
          <RunsList
            runs={state.runs}
            selectedRunId={state.selectedRunId}
            onSelectRun={state.setSelectedRunId}
          />
          <RunDetailPanel inputClass={inputClass} selectClass={selectClass} state={state} />
        </section>
      </div>
    </div>
  );
}
