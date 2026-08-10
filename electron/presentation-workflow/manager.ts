import type { WhatsAppAgent } from '../whatsapp-agent';
import type { WhatsAppService } from '../whatsapp-service';
import type { SkillWorkspaceService } from '../skill-workspace/service';
import { PresentacionWorkflow } from './workflow';

class WorkflowManagerClass {
  private activeWorkflows = new Map<string, PresentacionWorkflow>();

  isActive(sessionKey: string): boolean {
    return this.activeWorkflows.has(sessionKey);
  }

  async startWorkflow(
    sessionKey: string,
    jid: string,
    senderNumber: string,
    waService: WhatsAppService,
    agent: WhatsAppAgent,
    workspaceService: SkillWorkspaceService,
  ) {
    this.activeWorkflows.get(sessionKey)?.dispose();
    const workflow = new PresentacionWorkflow(
      sessionKey, jid, senderNumber, waService, agent, workspaceService,
      () => this.endWorkflow(sessionKey),
    );
    this.activeWorkflows.set(sessionKey, workflow);
    await workflow.start();
  }

  async handleMessage(sessionKey: string, text: string): Promise<boolean> {
    const workflow = this.activeWorkflows.get(sessionKey);
    if (!workflow) return false;
    const isStillActive = await workflow.handleInput(text);
    if (!isStillActive) this.endWorkflow(sessionKey);
    return true;
  }

  endWorkflow(sessionKey: string) {
    this.activeWorkflows.get(sessionKey)?.dispose();
    this.activeWorkflows.delete(sessionKey);
  }
}

export const WorkflowManager = new WorkflowManagerClass();
