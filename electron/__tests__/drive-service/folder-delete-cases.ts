import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDriveService } from './setup';
import { mockFilesCreate, mockFilesDelete, resetDriveMocks } from './mocks';
import type { DriveService } from '../../drive-service';

describe('DriveService folder and delete operations', () => {
  let service: DriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDriveMocks();
    service = createDriveService();
  });

  it('DRV-007: createFolder creates a folder with parent', async () => {
    mockFilesCreate.mockResolvedValueOnce({ data: { id: 'folder-new' } });

    const result = await service.createFolder('Mi Carpeta', 'parent-folder-id');

    expect(result.success).toBe(true);
    expect(result.folderId).toBe('folder-new');
    expect(mockFilesCreate).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        name: 'Mi Carpeta',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['parent-folder-id'],
      }),
    }));
  });

  it('DRV-008: deleteFile removes a file from Drive', async () => {
    const result = await service.deleteFile('file-to-delete');

    expect(result.success).toBe(true);
    expect(mockFilesDelete).toHaveBeenCalledWith({ fileId: 'file-to-delete' });
  });
});
