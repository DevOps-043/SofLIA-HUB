import { AgendaWorkflowConfig, CorreoWorkflowConfig, SeguimientoWorkflowConfig } from './workflow-config-form/basic-workflows';
import { DriveWorkflowConfig, PcWorkflowConfig, TeamUpdateWorkflowConfig } from './workflow-config-form/ops-workflows';
import type { WorkflowConfigFormProps } from './workflow-config-form/types';
import { MeetingWorkflowConfig } from './workflow-config-form/MeetingWorkflowConfig';

export function WorkflowConfigForm(props: WorkflowConfigFormProps) {
  switch (props.workflow.id) {
    case 'correo':
      return <CorreoWorkflowConfig {...props} />;
    case 'agenda':
      return <AgendaWorkflowConfig {...props} />;
    case 'seguimiento':
      return <SeguimientoWorkflowConfig {...props} />;
    case 'reuniones':
      return <MeetingWorkflowConfig {...props} />;
    case 'drive':
      return <DriveWorkflowConfig {...props} />;
    case 'actualizacion_equipo':
      return <TeamUpdateWorkflowConfig {...props} />;
    case 'pc':
      return <PcWorkflowConfig {...props} />;
    default:
      return null;
  }
}
