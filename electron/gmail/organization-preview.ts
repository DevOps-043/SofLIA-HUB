import { buildOrganizationGroups } from './organization-groups';
import { saveOrganizationPlan } from './plan-storage';
import type {
  GetMessagesOptions,
  GmailLabelRecord,
  GmailOrganizationMessageSnapshot,
  GmailOrganizationPlanRecord,
  GmailOrganizationPreviewOptions,
  GmailOrganizationPreviewResult,
  GetMessagesResult,
} from './types';

export async function previewGmailOrganizationPlan(
  options: GmailOrganizationPreviewOptions | undefined,
  deps: {
    getLabels: () => Promise<{ success: boolean; labels?: GmailLabelRecord[]; error?: string }>;
    getMessages: (options?: GetMessagesOptions) => Promise<GetMessagesResult>;
  },
): Promise<GmailOrganizationPreviewResult> {
  const queryUsed = options?.query?.trim() || 'in:inbox';
  const maxMessages = Math.max(25, Math.min(options?.maxMessages || 250, 1000));
  const minGroupSize = Math.max(1, Math.min(options?.minGroupSize || 2, 20));
  const pageLimit = Math.max(1, Math.min(options?.pageLimit || 20, 50));
  const removeFromInbox = options?.removeFromInbox !== false;

  try {
    const labelsResult = await deps.getLabels();
    if (!labelsResult.success || !labelsResult.labels) {
      return { success: false, error: labelsResult.error || 'No se pudieron leer las etiquetas de Gmail.' };
    }

    const messages = await collectPreviewMessages(deps.getMessages, queryUsed, maxMessages, pageLimit);
    if (!messages.success) return messages;
    const existingLabelsByName = new Map(labelsResult.labels.map((label) => [label.name.toLowerCase(), label.id]));
    const groups = buildOrganizationGroups(messages.messages, minGroupSize, existingLabelsByName);
    const groupedMessageIds = new Set(groups.flatMap((group) => group.messageIds));
    const planId = `gmail-plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const planRecord: GmailOrganizationPlanRecord = {
      id: planId,
      createdAt: new Date().toISOString(),
      queryUsed,
      removeFromInbox,
      minGroupSize,
      scannedMessages: messages.messages.length,
      truncated: messages.truncated,
      status: 'preview',
      groups,
      messages: messages.messages,
    };
    await saveOrganizationPlan(planRecord);
    return {
      success: true,
      planId,
      queryUsed,
      scannedMessages: messages.messages.length,
      groupedMessages: groupedMessageIds.size,
      uncategorizedMessages: Math.max(0, messages.messages.length - groupedMessageIds.size),
      truncated: messages.truncated,
      removeFromInbox,
      groups: groups.map(({ groupKey, labelName, count, domains, sampleSenders, sampleSubjects, existingLabelId }) => ({
        groupKey,
        labelName,
        count,
        domains,
        sampleSenders,
        sampleSubjects,
        existingLabelId,
      })),
    };
  } catch (err: any) {
    console.error('[GmailService] PreviewOrganizationPlan error:', err.message);
    return { success: false, error: err.message };
  }
}

async function collectPreviewMessages(
  getMessages: (options?: GetMessagesOptions) => Promise<GetMessagesResult>,
  queryUsed: string,
  maxMessages: number,
  pageLimit: number,
) {
  let pageToken: string | undefined;
  const messages: GmailOrganizationMessageSnapshot[] = [];
  for (let pageCount = 0; messages.length < maxMessages && pageCount < pageLimit; pageCount++) {
    const pageResult = await getMessages({ query: queryUsed, maxResults: Math.min(50, maxMessages - messages.length), pageToken });
    if (!pageResult.success) return { success: false as const, error: pageResult.error || 'No se pudieron leer mensajes de Gmail.' };
    for (const message of pageResult.messages || []) {
      messages.push({ id: message.id, from: message.from, subject: message.subject, labelIds: message.labelIds || [] });
    }
    pageToken = pageResult.nextPageToken;
    if (!pageToken) break;
  }
  return { success: true as const, messages, truncated: Boolean(pageToken) };
}
