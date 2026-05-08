import { expect, it } from 'vitest';
import { mockFilesCreate, mockFilesDelete } from './setup';
import type { DriveServiceTestContext } from './types';

export function registerDriveMutationTests(ctx: DriveServiceTestContext) {
  it('DRV-007: createFolder creates folder with correct parent', async () => {
    mockFilesCreate.mockResolvedValueOnce({ data: { id: 'folder-new' } });

    const result = await ctx.getService().createFolder('Mi Carpeta', 'parent-folder-id');

    expect(result.success).toBe(true);
    expect(result.folderId).toBe('folder-new');
    expect(mockFilesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          name: 'Mi Carpeta',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['parent-folder-id'],
        }),
      }),
    );
  });

  it('DRV-008: deleteFile removes file from Drive', async () => {
    const result = await ctx.getService().deleteFile('file-to-delete');
    expect(result.success).toBe(true);
    expect(mockFilesDelete).toHaveBeenCalledWith({ fileId: 'file-to-delete' });
  });
}
