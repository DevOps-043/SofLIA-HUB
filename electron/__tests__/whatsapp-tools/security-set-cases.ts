import { describe, expect, it } from 'vitest';
import { BLOCKED_TOOLS_WA, CONFIRM_TOOLS_WA, GROUP_BLOCKED_TOOLS, tools } from './context';

describe('BLOCKED_TOOLS_WA', () => {
  it('WA-069: is an empty Set', () => {
    expect(BLOCKED_TOOLS_WA).toBeInstanceOf(Set);
    expect(BLOCKED_TOOLS_WA.size).toBe(0);
  });

  it('WA-070: no declared tool is blocked globally', () => {
    for (const tool of tools) expect(BLOCKED_TOOLS_WA.has(tool.name)).toBe(false);
  });
});

describe('CONFIRM_TOOLS_WA', () => {
  it('WA-071 to WA-076: covers risky tools', () => {
    expect(CONFIRM_TOOLS_WA).toBeInstanceOf(Set);
    expect(CONFIRM_TOOLS_WA.size).toBeGreaterThanOrEqual(30);
    for (const name of ['delete_item', 'execute_command', 'send_email', 'shutdown_computer', 'gmail_send', 'gchat_send_message']) {
      expect(CONFIRM_TOOLS_WA.has(name)).toBe(true);
    }
  });
});

describe('GROUP_BLOCKED_TOOLS', () => {
  it('WA-077: is a Set with broad group restrictions', () => {
    expect(GROUP_BLOCKED_TOOLS).toBeInstanceOf(Set);
    expect(GROUP_BLOCKED_TOOLS.size).toBeGreaterThanOrEqual(20);
  });

  it('WA-078: blocks dangerous file, system and app-chat tools in groups', () => {
    const expected = [
      'execute_command',
      'write_file',
      'delete_item',
      'clipboard_write',
      'kill_process',
      'lock_session',
      'open_application',
      'organize_files',
      'app_chat_list_conversations',
      'app_chat_get_context',
      'app_chat_append_note',
      'app_chat_list_assets',
      'app_chat_send_asset',
    ];
    for (const name of expected) expect(GROUP_BLOCKED_TOOLS.has(name)).toBe(true);
  });

  it('WA-079: substantially overlaps with confirmation controls', () => {
    const union = new Set([...CONFIRM_TOOLS_WA, ...BLOCKED_TOOLS_WA]);
    const overlapCount = Array.from(GROUP_BLOCKED_TOOLS).filter(tool => union.has(tool)).length;
    expect(overlapCount).toBeGreaterThan(GROUP_BLOCKED_TOOLS.size * 0.5);
  });

  it('WA-080: entries are snake_case strings', () => {
    for (const tool of GROUP_BLOCKED_TOOLS) {
      expect(typeof tool).toBe('string');
      expect(tool).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
