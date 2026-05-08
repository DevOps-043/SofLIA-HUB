import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDriveService } from './setup';
import { mockFilesCreate, mockFilesList, resetDriveMocks } from './mocks';
import type { DriveService } from '../../drive-service';

describe('DriveService list, search and upload', () => {
  let service: DriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDriveMocks();
    service = createDriveService();
  });

  it('DRV-001: listFiles returns files matching query', async () => {
    const result = await service.listFiles({ query: "name contains 'Doc'" });

    expect(result.success).toBe(true);
    expect(result.files?.[0]).toMatchObject({ id: 'f1', name: 'Doc.txt', size: 1024 });
    const listCall = mockFilesList.mock.calls[0]?.[0];
    expect(listCall?.q).toContain('trashed = false');
    expect(listCall?.q).toContain("name contains 'Doc'");
  });

  it('DRV-002: searchFiles falls through 3 strategies when strict matches are empty', async () => {
    let callCount = 0;
    mockFilesList.mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) return { data: { files: [], nextPageToken: undefined } };
      return { data: { files: [{ id: 'f-found', name: 'Found.txt', mimeType: 'text/plain' }], nextPageToken: undefined } };
    });

    const result = await service.searchFiles('notas reunion');

    expect(result.success).toBe(true);
    expect(result.files!.length).toBeGreaterThan(0);
    expect(mockFilesList.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('DRV-003: uploadFile creates a Drive file and returns metadata', async () => {
    const result = await service.uploadFile('/tmp/test.pdf', {
      name: 'report.pdf',
      folderId: 'folder-123',
    });

    expect(result.success).toBe(true);
    expect(result.file?.id).toBe('f-uploaded');
    const createCall = mockFilesCreate.mock.calls[0]?.[0];
    expect(createCall?.requestBody?.name).toBe('report.pdf');
    expect(createCall?.requestBody?.parents).toEqual(['folder-123']);
  });
});
