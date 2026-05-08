import { describe, expect, it } from 'vitest';
import { toolMap } from './context';

function expectRequired(toolName: string, requiredFields: string[]) {
  const tool = toolMap.get(toolName);
  expect(tool).toBeDefined();
  for (const field of requiredFields) {
    expect(tool!.parameters.required).toContain(field);
  }
}

describe('WA_TOOL_DECLARATIONS specific parameter validation', () => {
  it('WA-059: list_directory has path property', () => {
    const tool = toolMap.get('list_directory');
    expect(tool).toBeDefined();
    expect(tool!.parameters.properties).toHaveProperty('path');
  });

  it('WA-060 to WA-068: core tools declare required fields', () => {
    expectRequired('read_file', ['path']);
    expectRequired('write_file', ['path', 'content']);
    expectRequired('gmail_send', ['to', 'subject', 'body']);
    expectRequired('web_search', ['query']);
    expectRequired('execute_command', ['command']);
    expectRequired('send_email', ['to', 'subject', 'body']);
    expectRequired('use_computer', ['task']);
    expectRequired('delete_item', ['path']);
    expectRequired('search_files', ['pattern']);
  });

  it('WA-068A to WA-068C: app chat tools declare privacy-sensitive refs', () => {
    expectRequired('app_chat_get_context', ['conversation_ref']);
    expectRequired('app_chat_append_note', ['conversation_ref', 'content']);
    expectRequired('app_chat_send_asset', ['conversation_ref', 'asset_ref']);
  });
});
