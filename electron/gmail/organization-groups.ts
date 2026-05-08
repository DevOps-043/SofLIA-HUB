import { inferMessageGrouping, sanitizeLabelName } from './helpers';
import type {
  GmailOrganizationMessageSnapshot,
  GmailOrganizationPlanGroup,
} from './types';

type MutableOrganizationGroup = {
  groupKey: string;
  labelName: string;
  domains: Set<string>;
  senders: Set<string>;
  subjects: Set<string>;
  messageIds: string[];
  existingLabelId?: string;
};

export function buildOrganizationGroups(
  messages: GmailOrganizationMessageSnapshot[],
  minGroupSize: number,
  existingLabelsByName: Map<string, string>,
): GmailOrganizationPlanGroup[] {
  const groupMap = new Map<string, MutableOrganizationGroup>();

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
    .sort((left, right) => right.count - left.count || left.labelName.localeCompare(right.labelName));
}
