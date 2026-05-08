import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDriveService } from './setup';
import { mockFilesExport, mockFilesGet, resetDriveMocks } from './mocks';
import type { DriveService } from '../../drive-service';

describe('DriveService download conversions', () => {
  let service: DriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDriveMocks();
    service = createDriveService();
  });

  it('DRV-004: downloadFile exports Google Docs as text/plain', async () => {
    mockFilesGet.mockImplementationOnce(async () => ({
      data: { mimeType: 'application/vnd.google-apps.document', name: 'My Document' },
    }));

    const result = await service.downloadFile('doc-id', '/tmp/output.txt', 'text');

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

    const result = await service.downloadFile('sheet-id', '/tmp/output.xlsx', 'text');

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
    const result = await service.downloadFile('big-file', '/tmp/huge.txt');

    expect(result.success).toBe(true);
    expect(result.textContent).toBeDefined();
    expect(result.textContent!.length).toBeLessThan(60_000);
    expect(result.textContent).toContain('contenido truncado');
  });
});
