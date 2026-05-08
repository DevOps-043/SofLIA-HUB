import type { WorkspaceApis } from './workspace-api';
import { unavailable } from './workspace-api';
import { buildSafeGmailSendParams } from './email-security';

export async function executeGmailTool(toolName: string, args: Record<string, any>, apis: WorkspaceApis): Promise<string | null> {
  const { gmail } = apis;
  if (!toolName.startsWith('gmail_')) return null;
  if (!gmail) return unavailable('Gmail no conectado.');
  switch (toolName) {
    case 'gmail_get_messages':
      return JSON.stringify(await gmail.getMessages({ query: args.query, maxResults: args.max_results || 10, labelIds: args.label_ids, pageToken: args.page_token }));
    case 'gmail_read_message':
      return JSON.stringify(await gmail.getMessage(args.message_id));
    case 'gmail_send':
      return JSON.stringify(await gmail.send(buildSafeGmailSendParams(args)));
    case 'gmail_get_labels':
      return JSON.stringify(await gmail.getLabels());
    case 'gmail_preview_organization':
      return JSON.stringify(await gmail.previewOrganization({
        query: args.query,
        maxMessages: args.max_messages,
        minGroupSize: args.min_group_size,
        removeFromInbox: args.remove_from_inbox,
        pageLimit: args.page_limit,
      }));
    case 'gmail_apply_organization_plan':
      return JSON.stringify(await gmail.applyOrganizationPlan(args.plan_id, { removeFromInbox: args.remove_from_inbox }));
    case 'gmail_undo_organization_plan':
      return JSON.stringify(await gmail.undoOrganizationPlan(args.plan_id));
    case 'gmail_create_label':
      return JSON.stringify(await gmail.createLabel(args.name));
    case 'gmail_delete_label':
      return JSON.stringify(await gmail.deleteLabel(args.label_id));
    case 'gmail_modify_labels':
      return JSON.stringify(await gmail.modifyLabels(args.message_id, args.add_labels, args.remove_labels));
    case 'gmail_batch_empty_label':
      return JSON.stringify(await gmail.batchModifyByLabel(args.label_id, { deleteLabel: args.delete_label || false }));
    case 'gmail_empty_all_labels':
      return JSON.stringify(await gmail.emptyAndDeleteAllLabels());
    default:
      return null;
  }
}
