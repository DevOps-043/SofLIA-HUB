/**
 * DriveService Tests — DRV-001 to DRV-008
 * Tests Google Drive API integration: list, search, upload, download, folder, delete.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassThrough } from 'node:stream';

// ─── Mock googleapis ────────────────────────────────────────────────
const mockFilesList = vi.fn(async () => ({
  data: {
    files: [
      { id: 'f1', name: 'Doc.txt', mimeType: 'text/plain', size: '1024' },
      { id: 'f2', name: 'Sheet.csv', mimeType: 'text/csv', size: '2048' },
    ],
    nextPageToken: undefined,
  },
}));

const mockFilesGet = vi.fn(async (args: any) => {
  if (args.alt === 'media') {
    const stream = new PassThrough();
    setTimeout(() => { stream.end('binary-content'); }, 5);
    return { data: stream };
  }
  // metadata request
  return {
    data: {
      id: args.fileId,
      name: 'test-file.txt',
      mimeType: args._testMimeType || 'text/plain',
    },
  };
});

const mockFilesCreate = vi.fn(async () => ({
  data: {
    id: 'f-uploaded',
    name: 'uploaded.pdf',
    mimeType: 'application/pdf',
    size: '5000',
  },
}));

const mockFilesExport = vi.fn(async () => {
  const stream = new PassThrough();
  setTimeout(() => { stream.end('exported-content'); }, 5);
  return { data: stream };
});

const mockFilesDelete = vi.fn(async () => ({}));

vi.mock('googleapis', () => ({
  google: {
    drive: vi.fn(() => ({
      files: {
        list: mockFilesList,
        get: mockFilesGet,
        create: mockFilesCreate,
        export: mockFilesExport,
        delete: mockFilesDelete,
      },
    })),
  },
}));

// ─── Mock node:fs ───────────────────────────────────────────────────
const mockCreateReadStream = vi.fn(() => new PassThrough());
const mockCreateWriteStream = vi.fn(() => {
  const ws = new PassThrough();
  // Simulate write completion
  (ws as any).path = '/tmp/test-output.txt';
  return ws;
});

vi.mock('node:fs', () => ({
  default: {
    createReadStream: (...args: any[]) => mockCreateReadStream(...args),
    createWriteStream: (...args: any[]) => mockCreateWriteStream(...args),
    existsSync: vi.fn(() => true),
  },
  createReadStream: (...args: any[]) => mockCreateReadStream(...args),
  createWriteStream: (...args: any[]) => mockCreateWriteStream(...args),
  existsSync: vi.fn(() => true),
}));

// ─── Mock node:fs/promises ──────────────────────────────────────────
vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    readFile: vi.fn(async () => 'file-text-content'),
  },
  access: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  readFile: vi.fn(async () => 'file-text-content'),
}));

// ─── Mock CalendarService dependency ────────────────────────────────
const mockGetGoogleAuth = vi.fn(async () => ({ type: 'authorized_user' }));
const mockCalendarService = {
  getGoogleAuth: mockGetGoogleAuth,
} as any;

// ─── Import after mocks ────────────────────────────────────────────
import { DriveService } from '../drive-service';

describe('DriveService', () => {
  let service: DriveService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGoogleAuth.mockResolvedValue({ type: 'authorized_user' });
    service = new DriveService(mockCalendarService);
  });

  // DRV-001: listFiles with query
  it('DRV-001: listFiles returns files matching query', async () => {
    const result = await service.listFiles({ query: "name contains 'Doc'" });

    expect(result.success).toBe(true);
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBe(2);
    expect(result.files![0].id).toBe('f1');
    expect(result.files![0].name).toBe('Doc.txt');
    expect(result.files![0].size).toBe(1024);

    // Verify query includes trashed filter
    const listCall = mockFilesList.mock.calls[0][0];
    expect(listCall.q).toContain('trashed = false');
    expect(listCall.q).toContain("name contains 'Doc'");
  });

  // DRV-002: searchFiles tries 3 strategies
  it('DRV-002: searchFiles falls through 3 strategies when strict match returns empty', async () => {
    // First call (strict): empty, second call (fullText): empty, third+ calls (individual words): results
    let callCount = 0;
    mockFilesList.mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        return { data: { files: [], nextPageToken: undefined } };
      }
      return {
        data: {
          files: [{ id: 'f-found', name: 'Found.txt', mimeType: 'text/plain' }],
          nextPageToken: undefined,
        },
      };
    });

    const result = await service.searchFiles('notas reunion');

    expect(result.success).toBe(true);
    expect(result.files!.length).toBeGreaterThan(0);
    // At least 3 calls: strict, fullText, individual word
    expect(mockFilesList.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  // DRV-003: uploadFile
  it('DRV-003: uploadFile creates file in Drive and returns metadata', async () => {
    const result = await service.uploadFile('/tmp/test.pdf', {
      name: 'report.pdf',
      folderId: 'folder-123',
    });

    expect(result.success).toBe(true);
    expect(result.file).toBeDefined();
    expect(result.file!.id).toBe('f-uploaded');
    expect(mockFilesCreate).toHaveBeenCalledTimes(1);

    const createCall = mockFilesCreate.mock.calls[0][0];
    expect(createCall.requestBody.name).toBe('report.pdf');
    expect(createCall.requestBody.parents).toEqual(['folder-123']);
  });

  // DRV-004: downloadFile exports Google Docs to text
  it('DRV-004: downloadFile exports Google Docs as text/plain', async () => {
    mockFilesGet.mockImplementationOnce(async () => ({
      data: {
        mimeType: 'application/vnd.google-apps.document',
        name: 'My Document',
      },
    }));

    const result = await service.downloadFile('doc-id', '/tmp/output.txt', 'text');

    expect(result.success).toBe(true);
    expect(result.path).toContain('.txt');
    expect(mockFilesExport).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'doc-id',
        mimeType: 'text/plain',
      }),
      expect.objectContaining({ responseType: 'stream' }),
    );
  });

  // DRV-005: downloadFile exports Sheets to CSV
  it('DRV-005: downloadFile exports Google Sheets as CSV', async () => {
    mockFilesGet.mockImplementationOnce(async () => ({
      data: {
        mimeType: 'application/vnd.google-apps.spreadsheet',
        name: 'My Sheet',
      },
    }));

    const result = await service.downloadFile('sheet-id', '/tmp/output.xlsx', 'text');

    expect(result.success).toBe(true);
    expect(result.path).toContain('.csv');
    expect(mockFilesExport).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'sheet-id',
        mimeType: 'text/csv',
      }),
      expect.objectContaining({ responseType: 'stream' }),
    );
  });

  // DRV-006: downloadFile truncates text content at 50KB
  it('DRV-006: downloadFile truncates text content exceeding 50KB', async () => {
    mockFilesGet.mockImplementationOnce(async () => ({
      data: { mimeType: 'text/plain', name: 'huge.txt' },
    }));

    // Mock readFile to return >50KB content
    const fsp = await import('node:fs/promises');
    const bigContent = 'x'.repeat(60_000);
    vi.mocked(fsp.default.readFile).mockResolvedValueOnce(bigContent);

    const result = await service.downloadFile('big-file', '/tmp/huge.txt');

    expect(result.success).toBe(true);
    expect(result.textContent).toBeDefined();
    expect(result.textContent!.length).toBeLessThan(60_000);
    expect(result.textContent).toContain('contenido truncado');
  });

  // DRV-007: createFolder with parentId
  it('DRV-007: createFolder creates folder with correct parent', async () => {
    mockFilesCreate.mockResolvedValueOnce({
      data: { id: 'folder-new' },
    });

    const result = await service.createFolder('Mi Carpeta', 'parent-folder-id');

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

  // DRV-008: deleteFile
  it('DRV-008: deleteFile removes file from Drive', async () => {
    const result = await service.deleteFile('file-to-delete');

    expect(result.success).toBe(true);
    expect(mockFilesDelete).toHaveBeenCalledWith({ fileId: 'file-to-delete' });
  });
});
