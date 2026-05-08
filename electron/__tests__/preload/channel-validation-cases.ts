import { describe, expect, it } from 'vitest';
import { ALLOWED_IPC_CHANNELS, validateChannel } from './helpers';

describe('Preload channel validation', () => {
  it('SEC-016: allowed channel passes without error', () => {
    expect(() => validateChannel('whatsapp:connect')).not.toThrow();
  });

  it('SEC-017: unauthorized channel throws', () => {
    expect(() => validateChannel('hacker:steal-data')).toThrow('Unauthorized IPC channel: hacker:steal-data');
  });

  it('SEC-018: empty channel throws', () => {
    expect(() => validateChannel('')).toThrow('Unauthorized IPC channel: ');
  });

  it('SEC-019: all computer namespace channels pass', () => {
    const computerChannels = ALLOWED_IPC_CHANNELS.filter(channel => channel.startsWith('computer:'));
    expect(computerChannels.length).toBeGreaterThanOrEqual(15);
    for (const channel of computerChannels) {
      expect(() => validateChannel(channel)).not.toThrow();
    }
  });

  it('SEC-020: random channel throws', () => {
    expect(() => validateChannel('random:nonexistent:channel')).toThrow('Unauthorized IPC channel');
  });
});
