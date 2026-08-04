import { expect, it } from 'vitest';
import { ALLOWED_IPC_CHANNELS, validateChannel } from './helpers';

export function registerPreloadChannelTests() {
  it('SEC-016: allowed channel passes without error', () => {
    expect(() => validateChannel('whatsapp:connect')).not.toThrow();
  });

  it.each([
    ['SEC-017: unauthorized channel throws error', 'hacker:steal-data'],
    ['SEC-018: empty string channel throws', ''],
    ['SEC-020: random string channel throws', 'random:nonexistent:channel'],
  ])('%s', (_label, channel) => {
    expect(() => validateChannel(channel)).toThrow('Unauthorized IPC channel');
  });

  it('SEC-019: all computer:* channels pass', () => {
    const computerChannels = ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('computer:'));
    expect(computerChannels.length).toBeGreaterThanOrEqual(15);
    computerChannels.forEach((channel) => {
      expect(() => validateChannel(channel)).not.toThrow();
    });
  });

  it('SEC-021: has 150+ channels total', () => {
    expect(ALLOWED_IPC_CHANNELS.length).toBeGreaterThanOrEqual(150);
  });

  it('SEC-022 to SEC-025: required namespaces are present', () => {
    const namespaceMinimums = [
      ['computer:', 15],
      ['whatsapp:', 5],
      ['desktop-agent:', 15],
      ['monitoring:', 3],
      ['calendar:', 3],
      ['gmail:', 3],
      ['drive:', 3],
      ['gchat:', 3],
    ] as const;
    for (const [namespace, minimum] of namespaceMinimums) {
      const count = ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith(namespace)).length;
      expect(count, `Expected ${namespace} channels`).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('SEC-030 to SEC-032: updater, memory and workflow-hub namespaces are present', () => {
    expect(ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('updater:')).length).toBeGreaterThanOrEqual(4);
    expect(ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('memory:')).length).toBeGreaterThanOrEqual(3);
    expect(ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('workflow-hub:')).length).toBeGreaterThanOrEqual(6);
  });

  it('SEC-035: el navegador integrado expone solo su contrato allowlisted', () => {
    const browserChannels = ALLOWED_IPC_CHANNELS.filter((channel) => channel.startsWith('integrated-browser:'));
    expect(browserChannels).toHaveLength(12);
    expect(browserChannels).toContain('integrated-browser:set-viewport');
    expect(browserChannels).toContain('integrated-browser:open-requested');
  });
}
