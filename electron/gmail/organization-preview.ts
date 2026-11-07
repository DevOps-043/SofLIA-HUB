import { buildOrganizationGroups } from './organization-groups';
import { randomUUID } from 'node:crypto';
import { gmailPreviewOptionsSchema } from '../../src/shared/gmail-organization';
import { GMAIL_PLAN_FAILURE, publicPlanError, type GmailPlanContext } from './plan-context';
import type { PrivateGmailPlan } from './plan-schema';
import type {
  GetMessagesOptions,
  GmailLabelRecord,
  GmailOrganizationMessageSnapshot,
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
  context: GmailPlanContext,
): Promise<GmailOrganizationPreviewResult> {
  try {
    const parsed = gmailPreviewOptionsSchema.parse(options === undefined ? {} : options);
    const queryUsed = parsed.query?.trim() || 'in:inbox';
    const maxMessages = parsed.maxMessages ?? 250;
    const minGroupSize = parsed.minGroupSize ?? 2;
    const pageLimit = parsed.pageLimit ?? 20;
    const removeFromInbox = parsed.removeFromInbox !== false;
    context.assert();
    const labelsResult = await deps.getLabels();
    context.assert();
    if (!labelsResult.success || !labelsResult.labels) {
      return { success: false, error: GMAIL_PLAN_FAILURE };
    }

    const messages = await collectPreviewMessages(deps.getMessages, queryUsed, maxMessages, pageLimit, context.assert);
    if (!messages.success) return messages;
    const existingLabelsByName = new Map(labelsResult.labels.map((label) => [label.name.toLowerCase(), label.id]));
    const groups = buildOrganizationGroups(messages.messages, minGroupSize, existingLabelsByName);
    const groupedMessageIds = new Set(groups.flatMap((group) => group.messageIds));
    const planId = `gmail-plan-${randomUUID()}`;
    const planRecord: PrivateGmailPlan = {
      id: planId,
      createdAt: new Date().toISOString(),
      queryUsed,
      removeFromInbox,
      minGroupSize,
      scannedMessages: messages.messages.length,
      truncated: messages.truncated,
      status: 'preview',
      groups: groups.map(({ groupKey, labelName, count, messageIds }) => ({ groupKey, labelName, count, messageIds })),
    };
    await context.store.save(planRecord, context.assert);
    context.assert();
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
  } catch (error) {
    return { success: false, error: publicPlanError(error) };
  }
}

async function collectPreviewMessages(
  getMessages: (options?: GetMessagesOptions) => Promise<GetMessagesResult>,
  queryUsed: string,
  maxMessages: number,
  pageLimit: number,
  assertCurrent: () => void,
) {
  let pageToken: string | undefined;
  const messages: GmailOrganizationMessageSnapshot[] = [];
  for (let pageCount = 0; messages.length < maxMessages && pageCount < pageLimit; pageCount++) {
    const pageResult = await getMessages({ query: queryUsed, maxResults: Math.min(50, maxMessages - messages.length), pageToken });
    assertCurrent();
    if (!pageResult.success) return { success: false as const, error: GMAIL_PLAN_FAILURE };
    for (const message of pageResult.messages || []) {
      if (messages.some(item => item.id === message.id)) throw new Error('Paginación repetida.');
      if (messages.length >= maxMessages) break;
      messages.push({ id: message.id, from: message.from.slice(0, 2048), subject: message.subject.slice(0, 500), labelIds: message.labelIds || [] });
    }
    pageToken = pageResult.nextPageToken;
    if (!pageToken) break;
  }
  return { success: true as const, messages, truncated: Boolean(pageToken) };
}
