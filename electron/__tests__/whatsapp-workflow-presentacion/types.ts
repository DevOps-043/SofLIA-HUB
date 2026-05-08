import type { PresentacionWorkflow } from '../../whatsapp-workflow-presentacion';

export type PresentationWorkflowTestContext = {
  getWorkflow: () => PresentacionWorkflow;
  WorkflowManager: any;
};

export type WorkflowManagerTestContext = {
  WorkflowManager: any;
};
