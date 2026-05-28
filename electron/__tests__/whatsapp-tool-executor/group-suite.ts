import { describe, expect, it } from 'vitest';
import { executeWhatsAppTools, fc, GROUP_BLOCKED_TOOLS, makeCtx } from './fixture';

describe('Group blocking - isGroup=true', () => {
  it('WA-091: blocks execute_command in group', async () => {
    const result = await executeWhatsAppTools([fc('execute_command', { command: 'dir' })], makeCtx(), 'group-jid', '5511111', true);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('grupo');
  });

  it('WA-092/093/094/095: blocks dangerous group tools', async () => {
    for (const tool of ['write_file', 'delete_item', 'clipboard_write', 'use_computer']) {
      const result = await executeWhatsAppTools([fc(tool, { path: 'test.txt', text: 'hello', task: 'abrir chrome' })], makeCtx(), 'group-jid', '5511111', true);
      expect(result.responses[0].functionResponse.response.success).toBe(false);
    }
  });

  it('WA-096: all GROUP_BLOCKED_TOOLS are rejected in group context', async () => {
    for (const toolName of GROUP_BLOCKED_TOOLS) {
      const result = await executeWhatsAppTools([fc(toolName, {})], makeCtx(), 'group-jid', '5511111', true);
      expect(result.responses[0].functionResponse.response.success).toBe(false);
    }
  });
});

describe('Group allowing - safe tools pass in groups', () => {
  it('WA-097/098/099/100: safe tools are not in the group-blocked set', () => {
    for (const tool of ['read_file', 'list_directory', 'get_system_info', 'web_search']) {
      expect(GROUP_BLOCKED_TOOLS.has(tool)).toBe(false);
    }
  });

  it('WA-101: master number can use group-blocked tools', async () => {
    const result = await executeWhatsAppTools(
      [fc('execute_command', { command: 'dir' })],
      makeCtx({ waService: { config: { masterNumber: '5511111', contactPermissions: {} } } as any, skipConfirmations: true }),
      'group-jid',
      '5511111',
      true,
    );
    expect(result.responses[0].functionResponse.response.success).toBe(true);
  });

  it('WA-102: granted contact can use a specific group-blocked category', async () => {
    const result = await executeWhatsAppTools(
      [fc('write_file', { path: 'test.txt', content: 'hola' })],
      makeCtx({
        waService: {
          config: {
            masterNumber: '5599999999',
            contactPermissions: { '5511111': ['files_write'] },
          },
        } as any,
      }),
      'group-jid',
      '5511111',
      true,
    );
    expect(result.responses[0].functionResponse.response.success).toBe(true);
  });
});

describe('Master access permissions - direct messages', () => {
  it('WA-103: blocks sensitive tools for non-master contacts without permission', async () => {
    const result = await executeWhatsAppTools(
      [fc('read_file', { path: 'C:/Users/test/notas.txt' })],
      makeCtx({ waService: { config: { masterNumber: '5599999999', contactPermissions: {} } } as any }),
      'jid',
      '5511111',
      false,
    );
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('Permiso requerido');
  });
});
