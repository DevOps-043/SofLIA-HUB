import { ActionTabs } from './ActionTabs';
import { BriefForm } from './forms/BriefForm';
import { CustomFlowForm } from './forms/CustomFlowForm';
import { DesktopActionForm } from './forms/DesktopActionForm';
import { DriveWorkspaceForm } from './forms/DriveWorkspaceForm';
import { ExecutiveUpdateForm } from './forms/ExecutiveUpdateForm';
import { FollowupForm } from './forms/FollowupForm';
import { MeetingPrepForm } from './forms/MeetingPrepForm';
import { TriageForm } from './forms/TriageForm';
import type { AutomationOpsController } from './useAutomationOpsController';

function ActiveActionForm({ controller }: { controller: AutomationOpsController }) {
  switch (controller.forms.action.active) {
    case 'triage':
      return <TriageForm controller={controller} />;
    case 'brief':
      return <BriefForm controller={controller} />;
    case 'followup':
      return <FollowupForm controller={controller} />;
    case 'meeting':
      return <MeetingPrepForm controller={controller} />;
    case 'drive':
      return <DriveWorkspaceForm controller={controller} />;
    case 'chat':
      return <ExecutiveUpdateForm controller={controller} />;
    case 'desktop':
      return <DesktopActionForm controller={controller} />;
    case 'custom':
      return <CustomFlowForm controller={controller} />;
  }
}

export function ActionBuilder({ controller }: { controller: AutomationOpsController }) {
  return (
    <>
      <ActionTabs controller={controller} />
      <div className="max-w-xl">
        <div className="bg-white dark:bg-[#1a1c20]/50 backdrop-blur-sm border border-gray-200 dark:border-white/10 rounded-2xl p-5 shadow-sm dark:shadow-lg">
          <ActiveActionForm controller={controller} />
        </div>
      </div>
    </>
  );
}
