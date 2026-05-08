import type { ChatCommandContext } from '../chat-commands';
import {
  handleAgendaCommand,
  handleApproveWorkflowCaseCommand,
  handleComputerWorkflowCommand,
  handleDriveProjectCommand,
  handleFollowUpCommand,
  handleMailReviewCommand,
  handleMeetingPrepCommand,
  handleMeetingWorkflowCommand,
  handlePendingWorkflowCasesCommand,
  handleRejectWorkflowCaseCommand,
  handleTeamUpdateCommand,
  handleWorkflowCatalogCommand,
} from '../workflow-chat-commands';

export async function handleWorkflowBusinessCommand(
  cmd: string,
  context: ChatCommandContext,
  args: string[],
): Promise<string | null | undefined> {
  switch (cmd) {
    case '/reuni\u00f3n':
    case '/reunion':
      return handleMeetingWorkflowCommand(toWorkflowContext(context, args));
    case '/correo':
    case '/correos':
      return handleMailReviewCommand(toWorkflowContext(context, args));
    case '/agenda':
      return handleAgendaCommand(toWorkflowContext(context, args));
    case '/seguimiento':
    case '/correoseguimiento':
      return handleFollowUpCommand(toWorkflowContext(context, args));
    case '/prepreunion':
    case '/reunionprep':
      return handleMeetingPrepCommand(toWorkflowContext(context, args));
    case '/driveproyecto':
      return handleDriveProjectCommand(toWorkflowContext(context, args));
    case '/chatdirectivo':
    case '/actualizacionchat':
      return handleTeamUpdateCommand(toWorkflowContext(context, args));
    case '/computadora':
    case '/pc':
    case '/escritorio':
      return handleComputerWorkflowCommand(toWorkflowContext(context, args));
    case '/crearflujo':
      return 'La creacion libre de flujos ya no esta habilitada por chat. Ahora guardas variantes sobre workflows predeterminados desde la app.';
    case '/flujos':
    case '/misflujos':
      return handleWorkflowCatalogCommand(context.workflowHubService);
    case '/usarflujo':
    case '/ejecutarflujo':
      return 'Los workflows ahora se ejecutan con comandos de negocio (/correo, /agenda, /seguimiento, /reunion, /driveproyecto, /chatdirectivo, /computadora) o desde variantes guardadas en la app.';
    case '/pendientes':
      return handlePendingWorkflowCasesCommand(context.workflowHubService);
    case '/aprobar':
    case '/autorizar':
      return handleApproveWorkflowCaseCommand(toWorkflowContext(context, args));
    case '/rechazar':
    case '/noautorizar':
      return handleRejectWorkflowCaseCommand(toWorkflowContext(context, args));
    default:
      return undefined;
  }
}

function toWorkflowContext(context: ChatCommandContext, args: string[]) {
  return {
    senderNumber: context.senderNumber,
    args,
    workflowHubService: context.workflowHubService,
    workspaceAutomationService: context.workspaceAutomationService,
  };
}
