import { describe, it, expect } from 'vitest';
import { executeToolDirect } from './context';

describe('Blocked command patterns', () => {
  const blockedCommands = [
    { id: 'CU-037', pattern: 'format', cmd: 'format C:' },
    { id: 'CU-038', pattern: 'diskpart', cmd: 'diskpart /s script.txt' },
    { id: 'CU-039', pattern: 'cipher /w', cmd: 'cipher /w:C:\\temp' },
    { id: 'CU-040', pattern: 'sfc', cmd: 'sfc /scannow' },
    { id: 'CU-041', pattern: 'bcdedit', cmd: 'bcdedit /set bootmode' },
    { id: 'CU-042', pattern: 'reg delete', cmd: 'reg delete HKLM\\Software\\Test' },
    { id: 'CU-043', pattern: 'reg add', cmd: 'reg add HKLM\\Software\\Test /v val /d data' },
    { id: 'CU-044', pattern: 'shutdown', cmd: 'shutdown /s /t 0' },
    { id: 'CU-045', pattern: 'taskkill /f /im explorer', cmd: 'taskkill /f /im explorer.exe' },
    { id: 'CU-046', pattern: 'rm -rf /', cmd: 'rm -rf / --no-preserve-root' },
    { id: 'CU-047', pattern: 'mkfs', cmd: 'mkfs.ext4 /dev/sda1' },
    { id: 'CU-048', pattern: 'dd if=', cmd: 'dd if=/dev/zero of=/dev/sda bs=1M' },
    { id: 'CU-049', pattern: 'fork bomb', cmd: ':(){:|:&};:' },
    { id: 'CU-050', pattern: 'net user', cmd: 'net user admin pass123 /add' },
    { id: 'CU-051', pattern: 'net localgroup administrators', cmd: 'net localgroup administrators hacker /add' },
  ];

  blockedCommands.forEach(({ id, pattern, cmd }) => {
    it(`${id}: blocks "${pattern}" command`, async () => {
      const result = await executeToolDirect('execute_command', { command: cmd });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/bloqueado/i);
    });
  });
});