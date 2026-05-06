/**
 * GmailService — orquestador de operaciones contra Gmail API.
 *
 * Esta clase es la API pública del paquete. Su responsabilidad es:
 *  - Resolver el cliente autenticado (vía `CalendarService.getGoogleAuth`)
 *  - Coordinar las llamadas a Gmail API
 *  - Mapear excepciones a respuestas tipadas `{ success, error }`
 *
 * La lógica pura (parsing, validación, agrupación) vive en `./helpers`,
 * la persistencia de planes en `./plan-storage`, y las operaciones batch
 * en `./batch`. Esta clase NO contiene esa lógica — solo la coordina.
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CalendarService } from '../calendar-service';
import { batchModifyMessageIds, drainLabelMessages } from './batch';
import {
  buildEmailMessage,
  chunkArray,
  getMimeType,
  inferMessageGrouping,
  isValidEmail,
  sanitizeLabelName,
} from './helpers';
import {
  findLatestAppliedOrganizationPlanId,
  loadOrganizationPlan,
  saveOrganizationPlan,
} from './plan-storage';
import type {
  EmailMessage,
  GetMessagesOptions,
  GetMessagesResult,
  GmailClient,
  GmailLabelRecord,
  GmailOrganizationApplyResult,
  GmailOrganizationMessageChange,
  GmailOrganizationMessageSnapshot,
  GmailOrganizationPlanGroup,
  GmailOrganizationPlanRecord,
  GmailOrganizationPreviewOptions,
  GmailOrganizationPreviewResult,
  GmailOrganizationUndoResult,
  SendEmailParams,
} from './types';

// `chunkArray` se utiliza internamente por `batchModifyMessageIds`/`drainLabelMessages`,
// pero también está disponible aquí por si la clase necesita procesar arrays.
void chunkArray;

const SYSTEM_LABEL_IDS = new Set([
  'INBOX', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT',
  'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CHAT',
]);

export class GmailService extends EventEmitter {
  private calendarService: CalendarService;

  constructor(calendarService: CalendarService) {
    super();
    this.calendarService = calendarService;
  }

  private async getClient(): Promise<{ client?: GmailClient; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { error: 'Google no conectado' };

    const { google } = await import('googleapis');
    return { client: google.gmail({ version: 'v1', auth }) as GmailClient };
  }

  async sendEmail(
    params: SendEmailParams,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Validación previa: bloqueamos header injection antes de tocar la red.
    try {
      const validate = (emails: string[] | undefined, fieldName: string) => {
        if (!emails || !emails.length) return;
        for (const email of emails) {
          if (!isValidEmail(email)) {
            throw new Error(
              `Patron de correo anomalo detectado en el campo '${fieldName}': validacion de seguridad fallida para "${email}".`,
            );
          }
        }
      };
      validate(params.to, 'to');
      validate(params.cc, 'cc');
      validate(params.bcc, 'bcc');
    } catch (validationErr: any) {
      console.error('[GmailService] Send error (Security):', validationErr.message);
      return { success: false, error: validationErr.message };
    }

    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const rawMessage = await this.buildRawMessage(params);
      const encodedMessage = Buffer.from(rawMessage).toString('base64url');
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });

      console.log(`[GmailService] Email sent: ${response.data.id}`);
      return { success: true, messageId: response.data.id || undefined };
    } catch (err: any) {
      console.error('[GmailService] Send error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /** Construye el cuerpo MIME crudo (con o sin adjuntos). */
  private async buildRawMessage(params: SendEmailParams): Promise<string> {
    const contentType = params.isHtml ? 'text/html' : 'text/plain';
    const toLine = params.to.join(', ');

    if (!params.attachmentPaths?.length) {
      return [
        `To: ${toLine}`,
        ...(params.cc?.length ? [`Cc: ${params.cc.join(', ')}`] : []),
        ...(params.bcc?.length ? [`Bcc: ${params.bcc.join(', ')}`] : []),
        `Subject: ${params.subject}`,
        `Content-Type: ${contentType}; charset=utf-8`,
        '',
        params.body,
      ].join('\r\n');
    }

    const boundary = `----=_SofLIA_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const headerLines = [
      `To: ${toLine}`,
      ...(params.cc?.length ? [`Cc: ${params.cc.join(', ')}`] : []),
      ...(params.bcc?.length ? [`Bcc: ${params.bcc.join(', ')}`] : []),
      `Subject: ${params.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: ${contentType}; charset=utf-8`,
      '',
      params.body,
    ];

    const parts: string[] = [headerLines.join('\r\n')];

    for (const filePath of params.attachmentPaths) {
      try {
        const fileData = await fs.readFile(filePath);
        const fileName = path.basename(filePath);
        const base64Data = fileData.toString('base64');
        const mimeType = getMimeType(fileName);

        parts.push(
          [
            `--${boundary}`,
            `Content-Type: ${mimeType}; name="${fileName}"`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${fileName}"`,
            '',
            base64Data,
          ].join('\r\n'),
        );
      } catch (fileErr: any) {
        console.warn(`[GmailService] Could not attach ${filePath}: ${fileErr.message}`);
      }
    }

    parts.push(`--${boundary}--`);
    return parts.join('\r\n');
  }

  async getMessages(options?: GetMessagesOptions): Promise<GetMessagesResult> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const maxResults = Math.max(1, Math.min(options?.maxResults || 20, 100));
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: options?.query,
        labelIds: options?.labelIds,
        pageToken: options?.pageToken,
      });

      const messageIds = listResponse.data.messages || [];
      if (messageIds.length === 0) {
        return {
          success: true,
          messages: [],
          nextPageToken: listResponse.data.nextPageToken || undefined,
          resultSizeEstimate: listResponse.data.resultSizeEstimate || 0,
        };
      }

      const details = await Promise.allSettled(
        messageIds
          .map((msg: any) => msg.id)
          .filter(Boolean)
          .map((id: string) =>
            gmail.users.messages.get({
              userId: 'me',
              id,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            }),
          ),
      );

      const messages = details
        .filter((d): d is PromiseFulfilledResult<any> => d.status === 'fulfilled')
        .map((d) => buildEmailMessage(d.value));

      return {
        success: true,
        messages,
        nextPageToken: listResponse.data.nextPageToken || undefined,
        resultSizeEstimate: listResponse.data.resultSizeEstimate || messages.length,
      };
    } catch (err: any) {
      console.error('[GmailService] GetMessages error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getMessage(
    messageId: string,
  ): Promise<{ success: boolean; message?: EmailMessage; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return { success: true, message: buildEmailMessage(detail) };
    } catch (err: any) {
      console.error('[GmailService] GetMessage error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async previewOrganizationPlan(
    options?: GmailOrganizationPreviewOptions,
  ): Promise<GmailOrganizationPreviewResult> {
    const queryUsed = options?.query?.trim() || 'in:inbox';
    const maxMessages = Math.max(25, Math.min(options?.maxMessages || 250, 1000));
    const minGroupSize = Math.max(1, Math.min(options?.minGroupSize || 2, 20));
    const pageLimit = Math.max(1, Math.min(options?.pageLimit || 20, 50));
    const removeFromInbox = options?.removeFromInbox !== false;

    try {
      const labelsResult = await this.getLabels();
      if (!labelsResult.success || !labelsResult.labels) {
        return {
          success: false,
          error: labelsResult.error || 'No se pudieron leer las etiquetas de Gmail.',
        };
      }

      const existingLabelsByName = new Map(
        labelsResult.labels.map((label) => [label.name.toLowerCase(), label.id]),
      );

      let pageToken: string | undefined;
      let pageCount = 0;
      const messages: GmailOrganizationMessageSnapshot[] = [];

      while (messages.length < maxMessages && pageCount < pageLimit) {
        const pageResult = await this.getMessages({
          query: queryUsed,
          maxResults: Math.min(50, maxMessages - messages.length),
          pageToken,
        });

        if (!pageResult.success) {
          return { success: false, error: pageResult.error || 'No se pudieron leer mensajes de Gmail.' };
        }

        for (const message of pageResult.messages || []) {
          messages.push({
            id: message.id,
            from: message.from,
            subject: message.subject,
            labelIds: message.labelIds || [],
          });
        }

        pageToken = pageResult.nextPageToken;
        pageCount += 1;
        if (!pageToken) break;
      }

      const groups = this.buildOrganizationGroups(messages, minGroupSize, existingLabelsByName);
      const groupedMessageIds = new Set(groups.flatMap((group) => group.messageIds));
      const groupedMessages = groupedMessageIds.size;
      const uncategorizedMessages = Math.max(0, messages.length - groupedMessages);
      const planId = `gmail-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const planRecord: GmailOrganizationPlanRecord = {
        id: planId,
        createdAt: new Date().toISOString(),
        queryUsed,
        removeFromInbox,
        minGroupSize,
        scannedMessages: messages.length,
        truncated: Boolean(pageToken),
        status: 'preview',
        groups,
        messages,
      };

      await saveOrganizationPlan(planRecord);

      return {
        success: true,
        planId,
        queryUsed,
        scannedMessages: messages.length,
        groupedMessages,
        uncategorizedMessages,
        truncated: Boolean(pageToken),
        removeFromInbox,
        groups: groups.map((group) => ({
          groupKey: group.groupKey,
          labelName: group.labelName,
          count: group.count,
          domains: group.domains,
          sampleSenders: group.sampleSenders,
          sampleSubjects: group.sampleSubjects,
          existingLabelId: group.existingLabelId,
        })),
      };
    } catch (err: any) {
      console.error('[GmailService] PreviewOrganizationPlan error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /** Agrupa mensajes en grupos candidatos para etiquetar. */
  private buildOrganizationGroups(
    messages: GmailOrganizationMessageSnapshot[],
    minGroupSize: number,
    existingLabelsByName: Map<string, string>,
  ): GmailOrganizationPlanGroup[] {
    const groupMap = new Map<
      string,
      {
        groupKey: string;
        labelName: string;
        domains: Set<string>;
        senders: Set<string>;
        subjects: Set<string>;
        messageIds: string[];
        existingLabelId?: string;
      }
    >();

    for (const message of messages) {
      const grouping = inferMessageGrouping(message.from);
      if (!groupMap.has(grouping.groupKey)) {
        const labelName = sanitizeLabelName(grouping.labelName);
        groupMap.set(grouping.groupKey, {
          groupKey: grouping.groupKey,
          labelName,
          domains: new Set<string>(),
          senders: new Set<string>(),
          subjects: new Set<string>(),
          messageIds: [],
          existingLabelId: existingLabelsByName.get(labelName.toLowerCase()),
        });
      }

      const group = groupMap.get(grouping.groupKey)!;
      group.messageIds.push(message.id);
      if (grouping.domain) group.domains.add(grouping.domain);
      group.senders.add(grouping.senderSample);
      if (message.subject) group.subjects.add(message.subject);
    }

    return Array.from(groupMap.values())
      .filter((group) => group.messageIds.length >= minGroupSize)
      .map<GmailOrganizationPlanGroup>((group) => ({
        groupKey: group.groupKey,
        labelName: group.labelName,
        count: group.messageIds.length,
        domains: Array.from(group.domains).slice(0, 5),
        sampleSenders: Array.from(group.senders).slice(0, 5),
        sampleSubjects: Array.from(group.subjects).slice(0, 5),
        existingLabelId: group.existingLabelId,
        messageIds: group.messageIds,
      }))
      .sort(
        (left, right) =>
          right.count - left.count || left.labelName.localeCompare(right.labelName),
      );
  }

  async applyOrganizationPlan(
    planId: string,
    options?: { removeFromInbox?: boolean },
  ): Promise<GmailOrganizationApplyResult> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) {
      return {
        success: false,
        planId,
        groupsApplied: 0,
        messagesLabeled: 0,
        removeFromInbox: options?.removeFromInbox !== false,
        labelsCreated: [],
        labelsReused: [],
        error,
      };
    }

    try {
      const plan = await loadOrganizationPlan(planId);
      const removeFromInbox = options?.removeFromInbox ?? plan.removeFromInbox;
      const existingLabels = await this.getLabels();
      if (!existingLabels.success || !existingLabels.labels) {
        throw new Error(
          existingLabels.error || 'No se pudieron leer las etiquetas antes de aplicar el plan.',
        );
      }

      const labelsByName = new Map(
        existingLabels.labels.map((label) => [label.name.toLowerCase(), label]),
      );
      const messageMap = new Map(plan.messages.map((m) => [m.id, m]));
      const messageChanges: Record<string, GmailOrganizationMessageChange> = {};
      const labelsCreated: Array<{ id: string; name: string }> = [];
      const labelsReused: Array<{ id: string; name: string }> = [];
      const groupLabelIds: Record<string, string> = {};
      let messagesLabeled = 0;

      for (const group of plan.groups) {
        let label = labelsByName.get(group.labelName.toLowerCase());
        if (!label) {
          const created = await this.createLabel(group.labelName);
          if (!created.success || !created.label) {
            throw new Error(created.error || `No se pudo crear la etiqueta ${group.labelName}.`);
          }
          label = created.label;
          labelsByName.set(label.name.toLowerCase(), label);
          labelsCreated.push(label);
        } else if (!labelsReused.some((item) => item.id === label!.id)) {
          labelsReused.push(label);
        }

        groupLabelIds[group.groupKey] = label.id;
        const removeLabelIds = removeFromInbox ? ['INBOX'] : [];

        await batchModifyMessageIds(gmail, group.messageIds, [label.id], removeLabelIds);
        messagesLabeled += group.messageIds.length;

        for (const messageId of group.messageIds) {
          const snapshot = messageMap.get(messageId);
          if (!snapshot) continue;
          const addedLabelIds = snapshot.labelIds.includes(label.id) ? [] : [label.id];
          const removedLabelIds =
            removeFromInbox && snapshot.labelIds.includes('INBOX') ? ['INBOX'] : [];
          messageChanges[messageId] = { addedLabelIds, removedLabelIds };
        }
      }

      plan.status = 'applied';
      plan.removeFromInbox = removeFromInbox;
      plan.applyResult = {
        appliedAt: new Date().toISOString(),
        labelsCreated,
        labelsReused,
        groupLabelIds,
        messageChanges,
        removeFromInbox,
      };

      await saveOrganizationPlan(plan);

      return {
        success: true,
        planId,
        groupsApplied: plan.groups.length,
        messagesLabeled,
        removeFromInbox,
        labelsCreated,
        labelsReused,
      };
    } catch (err: any) {
      console.error('[GmailService] ApplyOrganizationPlan error:', err.message);
      return {
        success: false,
        planId,
        groupsApplied: 0,
        messagesLabeled: 0,
        removeFromInbox: options?.removeFromInbox !== false,
        labelsCreated: [],
        labelsReused: [],
        error: err.message,
      };
    }
  }

  async undoOrganizationPlan(planId?: string): Promise<GmailOrganizationUndoResult> {
    try {
      const resolvedPlanId = planId || (await findLatestAppliedOrganizationPlanId());
      if (!resolvedPlanId) {
        return {
          success: false,
          planId: planId || '',
          messagesRestored: 0,
          labelsDeleted: 0,
          error: 'No encontre un plan de organización aplicado para revertir.',
        };
      }

      const plan = await loadOrganizationPlan(resolvedPlanId);
      if (!plan.applyResult) {
        return {
          success: false,
          planId: resolvedPlanId,
          messagesRestored: 0,
          labelsDeleted: 0,
          error: 'Ese plan todavia no ha sido aplicado.',
        };
      }

      let messagesRestored = 0;
      for (const [messageId, change] of Object.entries(plan.applyResult.messageChanges)) {
        const result = await this.modifyLabels(messageId, change.removedLabelIds, change.addedLabelIds);
        if (!result.success) {
          throw new Error(result.error || `No se pudo revertir el mensaje ${messageId}.`);
        }
        messagesRestored += 1;
      }

      let labelsDeleted = 0;
      for (const label of plan.applyResult.labelsCreated) {
        const labelMessages = await this.getMessages({ labelIds: [label.id], maxResults: 1 });
        if (labelMessages.success && (labelMessages.messages?.length || 0) === 0) {
          const deleteResult = await this.deleteLabel(label.id);
          if (deleteResult.success) labelsDeleted += 1;
        }
      }

      plan.status = 'undone';
      plan.undoneAt = new Date().toISOString();
      await saveOrganizationPlan(plan);

      return { success: true, planId: resolvedPlanId, messagesRestored, labelsDeleted };
    } catch (err: any) {
      console.error('[GmailService] UndoOrganizationPlan error:', err.message);
      return {
        success: false,
        planId: planId || '',
        messagesRestored: 0,
        labelsDeleted: 0,
        error: err.message,
      };
    }
  }

  async modifyLabels(
    messageId: string,
    addLabels?: string[],
    removeLabels?: string[],
  ): Promise<{ success: boolean; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const addLabelIds = await this.resolveLabelIds(addLabels, { createMissing: true });
      const removeLabelIds = await this.resolveLabelIds(removeLabels, { createMissing: false });

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { addLabelIds, removeLabelIds },
      });

      console.log(`[GmailService] Labels modified: ${messageId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GmailService] ModifyLabels error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Resuelve nombres/IDs de labels a IDs reales. Si `createMissing` es `true`
   * y un label solicitado no existe, se crea automáticamente.
   */
  private async resolveLabelIds(
    labels: string[] | undefined,
    options: { createMissing: boolean },
  ): Promise<string[]> {
    const requested = Array.isArray(labels)
      ? labels.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    if (requested.length === 0) return [];

    const labelsResult = await this.getLabels();
    if (!labelsResult.success || !labelsResult.labels) {
      throw new Error(labelsResult.error || 'No se pudieron leer las etiquetas de Gmail.');
    }

    const knownLabels = [...labelsResult.labels];
    const resolvedIds: string[] = [];
    for (const requestedLabel of requested) {
      const resolved = this.findLabelId(knownLabels, requestedLabel);
      if (resolved) {
        resolvedIds.push(resolved);
        continue;
      }

      if (!options.createMissing) {
        console.warn(
          `[GmailService] Label not found while resolving removeLabels: ${requestedLabel}`,
        );
        continue;
      }

      const created = await this.createLabel(requestedLabel);
      if (!created.success || !created.label?.id) {
        throw new Error(created.error || `No se pudo crear la etiqueta ${requestedLabel}.`);
      }
      knownLabels.push(created.label);
      resolvedIds.push(created.label.id);
    }

    return resolvedIds;
  }

  private findLabelId(labels: GmailLabelRecord[], query: string): string | null {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return null;

    const found = labels.find(
      (label) => label.id.toLowerCase() === normalized || label.name.toLowerCase() === normalized,
    );
    return found?.id || null;
  }

  async trashMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      await gmail.users.messages.trash({ userId: 'me', id: messageId });
      console.log(`[GmailService] Message trashed: ${messageId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GmailService] Trash error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async createLabel(
    name: string,
  ): Promise<{ success: boolean; label?: { id: string; name: string }; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      console.log(`[GmailService] Label created: ${response.data.id} (${name})`);
      return {
        success: true,
        label: { id: response.data.id || '', name: response.data.name || '' },
      };
    } catch (err: any) {
      // Si ya existe, devolvemos la existente (caso común en operaciones idempotentes).
      if (err.message?.includes('already exists') || err.code === 409) {
        const existing = await this.getLabels();
        const found = existing.labels?.find((l) => l.name.toLowerCase() === name.toLowerCase());
        if (found) return { success: true, label: found };
      }

      console.error('[GmailService] CreateLabel error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async batchModifyByLabel(
    labelId: string,
    options?: { addLabels?: string[]; removeLabels?: string[]; deleteLabel?: boolean },
  ): Promise<{
    success: boolean;
    processed: number;
    remaining: number;
    labelDeleted: boolean;
    error?: string;
  }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, processed: 0, remaining: 0, labelDeleted: false, error };

    try {
      const { processed, remaining } = await drainLabelMessages(gmail, labelId, options);
      let labelDeleted = false;

      if (options?.deleteLabel && remaining === 0) {
        try {
          await gmail.users.labels.delete({ userId: 'me', id: labelId });
          labelDeleted = true;
          console.log(`[GmailService] Label ${labelId} deleted after batch move`);
        } catch (delErr: any) {
          console.warn(`[GmailService] Could not delete label ${labelId}:`, delErr.message);
        }
      }

      return { success: true, processed, remaining, labelDeleted };
    } catch (err: any) {
      console.error('[GmailService] BatchModifyByLabel error:', err.message);
      return {
        success: false,
        processed: 0,
        remaining: 0,
        labelDeleted: false,
        error: err.message,
      };
    }
  }

  async emptyAndDeleteAllLabels(): Promise<{
    success: boolean;
    labelsProcessed: number;
    labelsDeleted: number;
    totalMessagesMovedToInbox: number;
    remainingLabels: string[];
    errors: string[];
  }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) {
      return {
        success: false,
        labelsProcessed: 0,
        labelsDeleted: 0,
        totalMessagesMovedToInbox: 0,
        remainingLabels: [],
        errors: [error || 'Google no conectado'],
      };
    }

    try {
      const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
      const allLabels = labelsResponse.data.labels || [];
      const userLabels = allLabels.filter(
        (label: any) => label.id && !SYSTEM_LABEL_IDS.has(label.id) && label.type === 'user',
      );

      let labelsProcessed = 0;
      let labelsDeleted = 0;
      let totalMessagesMovedToInbox = 0;
      const errors: string[] = [];

      for (const label of userLabels) {
        if (!label.id) continue;

        try {
          const { processed, remaining } = await drainLabelMessages(gmail, label.id);
          totalMessagesMovedToInbox += processed;
          labelsProcessed += 1;

          if (remaining === 0) {
            try {
              await gmail.users.labels.delete({ userId: 'me', id: label.id });
              labelsDeleted += 1;
              console.log(
                `[GmailService] Emptied (${processed} msgs) and deleted label: ${label.name} (${label.id})`,
              );
            } catch (delErr: any) {
              errors.push(`No se pudo eliminar "${label.name}": ${delErr.message}`);
            }
          } else {
            errors.push(`La etiqueta "${label.name}" aun tiene correos pendientes; no se elimino.`);
          }
        } catch (labelErr: any) {
          errors.push(`Error procesando "${label.name}": ${labelErr.message}`);
        }
      }

      const verifyResponse = await gmail.users.labels.list({ userId: 'me' });
      const remainingLabels = (verifyResponse.data.labels || [])
        .filter(
          (label: any) => label.id && !SYSTEM_LABEL_IDS.has(label.id) && label.type === 'user',
        )
        .map((label: any) => label.name || label.id || 'unknown');

      return {
        success: true,
        labelsProcessed,
        labelsDeleted,
        totalMessagesMovedToInbox,
        remainingLabels,
        errors,
      };
    } catch (err: any) {
      console.error('[GmailService] EmptyAndDeleteAllLabels error:', err.message);
      return {
        success: false,
        labelsProcessed: 0,
        labelsDeleted: 0,
        totalMessagesMovedToInbox: 0,
        remainingLabels: [],
        errors: [err.message],
      };
    }
  }

  async deleteLabel(labelId: string): Promise<{ success: boolean; error?: string }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      await gmail.users.labels.delete({ userId: 'me', id: labelId });
      console.log(`[GmailService] Label deleted: ${labelId}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GmailService] DeleteLabel error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async getLabels(): Promise<{
    success: boolean;
    labels?: Array<{ id: string; name: string }>;
    error?: string;
  }> {
    const { client: gmail, error } = await this.getClient();
    if (!gmail) return { success: false, error };

    try {
      const response = await gmail.users.labels.list({ userId: 'me' });
      const labels = (response.data.labels || []).map((label: any) => ({
        id: label.id || '',
        name: label.name || '',
      }));

      return { success: true, labels };
    } catch (err: any) {
      console.error('[GmailService] GetLabels error:', err.message);
      return { success: false, error: err.message };
    }
  }
}
