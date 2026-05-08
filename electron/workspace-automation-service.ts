import { EventEmitter } from 'node:events';
import { LlmTaskService } from './llm-task-service';
import { init } from './workspace-automation/service/init';
import { setApiKey } from './workspace-automation/service/set-api-key';
import { isConfigured } from './workspace-automation/service/is-configured';
import { listTemplates } from './workspace-automation/service/list-templates';
import { createCustomTemplate } from './workspace-automation/service/create-custom-template';
import { listRuns } from './workspace-automation/service/list-runs';
import { getRun } from './workspace-automation/service/get-run';
import { executeTemplate } from './workspace-automation/service/execute-template';
import { getTemplateHandlerContext } from './workspace-automation/service/get-template-handler-context';
import { approveRun } from './workspace-automation/service/approve-run';
import { rejectRun } from './workspace-automation/service/reject-run';
import { executeCustomTemplate } from './workspace-automation/service/execute-custom-template';
import { buildCustomWorkflowActions } from './workspace-automation/service/build-custom-workflow-actions';
import { executeAction } from './workspace-automation/service/execute-action';
import { createRun } from './workspace-automation/service/create-run';
import { appendLog } from './workspace-automation/service/append-log';
import { getMutableRun } from './workspace-automation/service/get-mutable-run';
import { getCustomTemplate } from './workspace-automation/service/get-custom-template';
import { persistAndEmit } from './workspace-automation/service/persist-and-emit';
import { getStatePath } from './workspace-automation/service/get-state-path';
import { loadState } from './workspace-automation/service/load-state';
import { saveState } from './workspace-automation/service/save-state';
import type { WorkflowDependencies, WorkflowState } from './workspace-automation/types';

export type {
  WorkflowActionRecord,
  WorkflowApprovalRecord,
  WorkflowRunRecord,
  WorkflowTemplateDefinition,
} from './workspace-automation/types';

export class WorkspaceAutomationService extends EventEmitter {
  state: WorkflowState = { runs: [], templates: [] };
  readonly llmTaskService = new LlmTaskService();

  constructor(readonly deps: WorkflowDependencies) {
    super();
  }

  init = init;
  setApiKey = setApiKey;
  isConfigured = isConfigured;
  listTemplates = listTemplates;
  createCustomTemplate = createCustomTemplate;
  listRuns = listRuns;
  getRun = getRun;
  executeTemplate = executeTemplate;
  getTemplateHandlerContext = getTemplateHandlerContext;
  approveRun = approveRun;
  rejectRun = rejectRun;
  executeCustomTemplate = executeCustomTemplate;
  buildCustomWorkflowActions = buildCustomWorkflowActions;
  executeAction = executeAction;
  createRun = createRun;
  appendLog = appendLog;
  getMutableRun = getMutableRun;
  getCustomTemplate = getCustomTemplate;
  persistAndEmit = persistAndEmit;
  getStatePath = getStatePath;
  loadState = loadState;
  saveState = saveState;
}
