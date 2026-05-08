import { expect, it, vi } from 'vitest';
import { mockFilesCreate, mockFilesExport, mockFilesGet } from './setup';
import type { DriveServiceTestContext } from './types';

export function registerDriveTransferTests(ctx: DriveServiceTestContext) {
  it('DRV-003: uploadFile creates file in Drive and returns metadata', async () => {
    const result = await ctx.getService().uploadFile('/tmp/test.pdf', {
      name: 'report.pdf',
      folderId: 'folder-123',
    });

    expect(result.success).toBe(true);
    expect(result.file?.id).toBe('f-uploaded');
    const createCall = mockFilesCreate.mock.calls[0]?.[0];
    if (!createCall?.requestBody) throw new Error('mockFilesCreate no recibio requestBody');
    expect(createCall.requestBody.name).toBe('report.pdf');
    expect(createCall.requestBody.parents).toEqual(['folder-123']);
  });

  it('DRV-004: downloadFile exports Google Docs as text/plain', async () => {
    mockFilesGet.mockImplementationOnce(async () => ({
      data: { mimeType: 'application/vnd.google-apps.document', name: 'My Document' },
    }));

    const result = await ctx.getService().downloadFile('doc-id', '/tmp/output.txt', 'text');

    expect(result.success).toBe(true);
    expect(result.path).toContain('.txt');
    expect(mockFilesExport).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'doc-id', mimeType: 'text/plain' }),
      expect.objectContaining({ responseType: 'stream' }),
    );
  });

  it('DRV-005: downloadFile exports Google Sheets as CSV', async () => {
    mockFilesGet.mockImplementationOnce(async () => ({
      data: { mimeType: 'application/vnd.google-apps.spreadsheet', name: 'My Sheet' },
    }));

    const result = await ctx.getService().downloadFile('sheet-id', '/tmp/output.xlsx', 'text');

    expect(result.success).toBe(true);
    expect(result.path).toContain('.csv');
    expect(mockFilesExport).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'sheet-id', mimeType: 'text/csv' }),
      expect.objectContaining({ responseType: 'stream' }),
    );
  });

  it('DRV-006: downloadFile truncates text content exceeding 50KB', async () => {
    mockFilesGet.mockImplementationOnce(async () => ({
      data: { mimeType: 'text/plain', name: 'huge.txt' },
    }));
    const fsp = await import('node:fs/promises');
    vi.mocked(fsp.default.readFile).mockResolvedValueOnce('x'.repeat(60_000));

    const result = await ctx.getService().downloadFile('big-file', '/tmp/huge.txt');

    expect(result.success).toBe(true);
    expect(result.textContent?.length).toBeLessThan(60_000);
    expect(result.textContent).toContain('contenido truncado');
  });
}
