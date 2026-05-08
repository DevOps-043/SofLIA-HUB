import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import type { WhatsAppService } from '../whatsapp-service';
import { MeetingWhatsAppWorkflow } from './workflow';

class MeetingWorkflowManagerClass {
  private readonly activeWorkflows = new Map<string, MeetingWhatsAppWorkflow>();

  isActive(sessionKey: string): boolean {
    return this.activeWorkflows.has(sessionKey);
  }

  async startWorkflow(
    sessionKey: string,
    jid: string,
    senderNumber: string,
    waService: WhatsAppService,
    workflowService: MeetingWorkflowService,
  ): Promise<void> {
    await this.startWorkflowInternal(sessionKey, jid, senderNumber, waService, workflowService);
  }

  async startWorkflowForExistingRun(
    sessionKey: string,
    jid: string,
    senderNumber: string,
    waService: WhatsAppService,
    workflowService: MeetingWorkflowService,
    runId: string,
    introMessage?: string | null,
  ): Promise<void> {
    await this.startWorkflowInternal(sessionKey, jid, senderNumber, waService, workflowService, runId, introMessage);
  }

  async handleMessage(sessionKey: string, text: string): Promise<boolean> {
    const workflow = this.activeWorkflows.get(sessionKey);
    if (!workflow) return false;

    const stillActive = await workflow.handleInput(text);
    if (!stillActive) this.endWorkflow(sessionKey);
    return true;
  }

  endWorkflow(sessionKey: string): void {
    const workflow = this.activeWorkflows.get(sessionKey);
    workflow?.dispose();
    this.activeWorkflows.delete(sessionKey);
  }

  private async startWorkflowInternal(
    sessionKey: string,
    jid: string,
    senderNumber: string,
    waService: WhatsAppService,
    workflowService: MeetingWorkflowService,
    runId?: string | null,
    introMessage?: string | null,
  ): Promise<void> {
    this.endWorkflow(sessionKey);
    const workflow = new MeetingWhatsAppWorkflow(
      sessionKey,
      jid,
      senderNumber,
      waService,
      workflowService,
      runId ?? null,
      introMessage ?? null,
      (key) => this.endWorkflow(key),
    );
    this.activeWorkflows.set(sessionKey, workflow);
    await workflow.start();
  }
}

export const MeetingWorkflowManager = new MeetingWorkflowManagerClass();
