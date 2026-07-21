import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getAppPath: () => process.cwd() },
}));

import { MeetingContextPackLoader } from '../meetings/context-pack/loader';

describe('MeetingContextPackLoader', () => {
  it('carga el Context Pack desde resources/context-packs/meetings/v1', async () => {
    const pack = await new MeetingContextPackLoader().load();

    expect(pack.promptMaster).toContain('Prompt maestro');
    expect(pack.packAgents).toContain('Meeting Intelligence Context');
    expect(pack.meetingTypes.length).toBeGreaterThan(0);
    expect(pack.outputSchema).toBeTypeOf('object');
    expect(pack.fallbackThreshold).toBeGreaterThan(0);
    expect(pack.missingFiles).toEqual([]);
  });
});
