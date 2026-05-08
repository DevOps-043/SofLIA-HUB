import { expect, it } from 'vitest';
import { mockFilesList } from './setup';
import type { DriveServiceTestContext } from './types';

export function registerDriveQueryTests(ctx: DriveServiceTestContext) {
  it('DRV-001: listFiles returns files matching query', async () => {
    const result = await ctx.getService().listFiles({ query: "name contains 'Doc'" });

    expect(result.success).toBe(true);
    expect(result.files?.length).toBe(2);
    expect(result.files?.[0]).toMatchObject({ id: 'f1', name: 'Doc.txt', size: 1024 });

    const listCall = mockFilesList.mock.calls[0]?.[0];
    if (!listCall) throw new Error('mockFilesList no recibio argumentos');
    expect(listCall.q).toContain('trashed = false');
    expect(listCall.q).toContain("name contains 'Doc'");
  });

  it('DRV-002: searchFiles falls through 3 strategies when strict match returns empty', async () => {
    let callCount = 0;
    mockFilesList.mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) return { data: { files: [], nextPageToken: undefined } };
      return {
        data: {
          files: [{ id: 'f-found', name: 'Found.txt', mimeType: 'text/plain' }],
          nextPageToken: undefined,
        },
      };
    });

    const result = await ctx.getService().searchFiles('notas reunion');

    expect(result.success).toBe(true);
    expect(result.files?.length).toBeGreaterThan(0);
    expect(mockFilesList.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
}
