import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import type { WhatsAppService } from '../whatsapp-service';
import { WORKFLOW_TIMEOUT_MS } from './constants';
import { handleMeetingWorkflowInput } from './workflow-input';
import { buildExistingRunIntroMessage, buildStartMessage } from './workflow-messages';

type WorkflowEndHandler = (sessionKey: string) => void;

export class MeetingWhatsAppWorkflow {
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public readonly sessionKey: string,
    public readonly jid: string,
    public readonly senderNumber: string,
    public readonly waService: WhatsAppService,
    public readonly workflowService: MeetingWorkflowService,
    public runId: string | null = null,
    private readonly introMessage: string | null = null,
    private readonly onEnd: WorkflowEndHandler = () => {},
  ) {}

  async start(): Promise<void> {
    this.scheduleInactivityTimeout();
    if (!this.runId) {
      await this.waService.sendText(this.jid, buildStartMessage());
      return;
    }

    const fallbackMessage = await buildExistingRunIntroMessage(this.workflowService, this.runId);
    await this.waService.sendText(this.jid, this.introMessage || fallbackMessage);
  }

  async handleInput(text: string): Promise<boolean> {
    return handleMeetingWorkflowInput(this, text);
  }

  dispose(): void {
    this.clearInactivityTimer();
  }

  scheduleInactivityTimeout(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.handleInactivityTimeout().catch((error) => {
        console.error('[MeetingWhatsAppWorkflow] Error handling inactivity timeout:', error);
      });
    }, WORKFLOW_TIMEOUT_MS);
  }

  clearInactivityTimer(): void {
    if (!this.inactivityTimer) return;
    clearTimeout(this.inactivityTimer);
    this.inactivityTimer = null;
  }

  async cancelWorkflow(message: string): Promise<boolean> {
    this.clearInactivityTimer();
    await this.waService.sendText(this.jid, message);
    this.onEnd(this.sessionKey);
    return false;
  }

  private async handleInactivityTimeout(): Promise<void> {
    this.clearInactivityTimer();
    await this.waService.sendText(
      this.jid,
      'Workflow de reuniones cancelado por inactividad despues de 5 minutos. Si quieres retomarlo, inicia /reunion de nuevo.',
    );
    this.onEnd(this.sessionKey);
  }
}
