import { expect, it } from 'vitest';
import { toolMap } from './context';

const requiredCases = [
  ['WA-060', 'read_file', ['path']],
  ['WA-061', 'write_file', ['path', 'content']],
  ['WA-062', 'gmail_send', ['to', 'subject', 'body']],
  ['WA-063', 'web_search', ['query']],
  ['WA-064', 'execute_command', ['command']],
  ['WA-065', 'send_email', ['to', 'subject', 'body']],
  ['WA-066', 'use_computer', ['task']],
  ['WA-067', 'delete_item', ['path']],
  ['WA-068', 'search_files', ['pattern']],
  ['WA-068A', 'app_chat_get_context', ['conversation_ref']],
  ['WA-068B', 'app_chat_append_note', ['conversation_ref', 'content']],
  ['WA-068C', 'app_chat_send_asset', ['conversation_ref', 'asset_ref']],
] as const;

export function registerWhatsAppSpecificToolTests() {
  it('WA-059: list_directory has path property', () => {
    const tool = toolMap.get('list_directory') as any;
    expect(tool).toBeDefined();
    expect(tool.parameters.properties).toHaveProperty('path');
  });

  it.each(requiredCases)('%s: %s requires expected fields', (_id, toolName, fields) => {
    const tool = toolMap.get(toolName) as any;
    expect(tool).toBeDefined();
    for (const field of fields) {
      expect(tool.parameters.required).toContain(field);
    }
  });
}
