import { WhatsAppService } from '../whatsapp-service';
import { WhatsAppAgent } from '../whatsapp-agent';
import type { SkillWorkspaceService } from '../skill-workspace/service';
import type { PresentacionData, WorkflowState } from './types';
import { CANCEL_WORKFLOW_PATTERN, WORKFLOW_TIMEOUT_MS } from './constants';
import { extractPresentationData } from './ai';
import { isApprovalText, isCancelApprovalText } from './approval';
import * as msg from './messages';
import { replyAndKeep, requestMissingData } from './responses';
import { completePresentation, requestProposal } from './steps';
import { WorkflowTimer } from './timer';

type WorkflowEndHandler = (sessionKey: string) => void;

export class PresentacionWorkflow {
  private state: WorkflowState = 'AWAITING_DATA';
  private data: PresentacionData = {};
  private readonly timer = new WorkflowTimer(() => void this.handleInactivityTimeout(), WORKFLOW_TIMEOUT_MS);

  constructor(
    public sessionKey: string, public jid: string, public senderNumber: string,
    private waService: WhatsAppService, private agent: WhatsAppAgent,
    private workspaceService: SkillWorkspaceService,
    private onEnd: WorkflowEndHandler = () => {},
  ) {}

  async start() {
    this.state = 'AWAITING_DATA';
    this.timer.schedule();
    await this.waService.sendText(this.jid, msg.START_CANCEL_MESSAGE);
    await this.waService.sendText(this.jid, msg.START_DATA_MESSAGE);
  }

  async handleInput(text: string): Promise<boolean> {
    if (CANCEL_WORKFLOW_PATTERN.test(text.trim())) return this.cancelWorkflow(msg.CANCELLED_MESSAGE);
    if (this.state === 'AWAITING_DATA') return this.handleDataInput(text);
    if (this.state === 'PROCESSING_PROPOSAL') return replyAndKeep(this.waService, this.jid, msg.PROCESSING_MESSAGE, () => this.timer.clear());
    if (this.state === 'AWAITING_APPROVAL') return this.handleApprovalInput(text);
    if (this.state === 'GENERATING_PRESENTATION') return replyAndKeep(this.waService, this.jid, msg.GENERATING_MESSAGE, () => this.timer.clear());
    return false;
  }

  dispose(): void { this.timer.clear(); }

  private async handleDataInput(text: string): Promise<boolean> {
    await this.extractData(text);
    if (!this.data.clientCompanyName || !this.data.clientEmail) return requestMissingData(this.waService, this.jid, () => this.timer.schedule());
    this.state = 'PROCESSING_PROPOSAL';
    this.timer.clear();
    await this.waService.sendText(this.jid, msg.buildDataConfirmedMessage(this.data));
    this.generateProposal().catch((err) => this.failWorkflow('Error en procesamiento', err, msg.PROCESSING_ERROR_MESSAGE));
    return true;
  }

  private async handleApprovalInput(text: string): Promise<boolean> {
    if (!isApprovalText(text)) return this.handleNonApproval(text);
    this.state = 'GENERATING_PRESENTATION';
    this.timer.clear();
    await this.waService.sendText(this.jid, msg.APPROVED_MESSAGE);
    this.finishPresentation().catch((err) => this.failWorkflow('Error generando la presentacion', err, msg.GENERATION_ERROR_MESSAGE));
    return true;
  }

  private async handleNonApproval(text: string): Promise<boolean> {
    if (isCancelApprovalText(text)) return this.cancelWorkflow(msg.CANCELLED_MESSAGE);
    this.timer.schedule();
    await this.waService.sendText(this.jid, msg.APPROVAL_HELP_MESSAGE);
    return true;
  }

  private async extractData(text: string): Promise<void> {
    Object.assign(this.data, await extractPresentationData(this.agent, text));
  }

  private async generateProposal(): Promise<void> {
    const proposal = await requestProposal(this.agent, this.data.clientCompanyName!, this.data.clientEmail!);
    this.data.proposalContent = proposal.proposalContent;
    this.state = 'AWAITING_APPROVAL';
    this.timer.schedule();
    await this.waService.sendText(this.jid, proposal.approvalMessage);
  }

  private async finishPresentation(): Promise<void> {
    const sendProgress = (text: string) => this.waService.sendText(this.jid, text);
    const resumen = await completePresentation(
      this.agent, this.workspaceService, this.waService, this.jid, this.data, sendProgress,
    );
    await this.waService.sendText(this.jid, resumen);
    this.state = 'COMPLETED';
    this.endWorkflow();
  }

  private async handleInactivityTimeout(): Promise<void> {
    if (this.state === 'COMPLETED') return;
    await this.waService.sendText(this.jid, msg.INACTIVITY_MESSAGE);
    this.endWorkflow();
  }

  private async cancelWorkflow(message: string): Promise<boolean> {
    await this.waService.sendText(this.jid, message);
    this.endWorkflow();
    return false;
  }

  private async failWorkflow(label: string, err: any, userMessage: string): Promise<void> {
    console.error(`[Workflow] ${label}:`, err);
    await this.waService.sendText(this.jid, userMessage);
    this.endWorkflow();
  }

  private endWorkflow(): void { this.timer.clear(); this.onEnd(this.sessionKey); }
}
