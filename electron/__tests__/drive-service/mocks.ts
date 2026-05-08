import { PassThrough } from 'node:stream';
import { vi } from 'vitest';

export const mockCreateReadStream = vi.fn();
export const mockCreateWriteStream = vi.fn();
export const mockFilesCreate = vi.fn();
export const mockFilesDelete = vi.fn();
export const mockFilesExport = vi.fn();
export const mockFilesGet = vi.fn();
export const mockFilesList = vi.fn();
export const mockGetGoogleAuth = vi.fn();

vi.doMock('googleapis', () => ({
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

vi.doMock('node:fs', () => ({
  default: {
    createReadStream: (filePath: string) => mockCreateReadStream(filePath),
    createWriteStream: (filePath: string) => mockCreateWriteStream(filePath),
    existsSync: vi.fn(() => true),
  },
  createReadStream: (filePath: string) => mockCreateReadStream(filePath),
  createWriteStream: (filePath: string) => mockCreateWriteStream(filePath),
  existsSync: vi.fn(() => true),
}));

vi.doMock('node:fs/promises', () => ({
  default: {
    access: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    readFile: vi.fn(async () => 'file-text-content'),
  },
  access: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  readFile: vi.fn(async () => 'file-text-content'),
}));

export function resetDriveMocks(): void {
  mockGetGoogleAuth.mockReset().mockResolvedValue({ type: 'authorized_user' });
  mockFilesList.mockReset().mockResolvedValue({
    data: {
      files: [
        { id: 'f1', name: 'Doc.txt', mimeType: 'text/plain', size: '1024' },
        { id: 'f2', name: 'Sheet.csv', mimeType: 'text/csv', size: '2048' },
      ],
      nextPageToken: undefined,
    },
  });
  mockFilesGet.mockReset().mockImplementation(async (args: any) => {
    if (args.alt === 'media') {
      const stream = new PassThrough();
      setTimeout(() => { stream.end('binary-content'); }, 5);
      return { data: stream };
    }
    return {
      data: { id: args.fileId, name: 'test-file.txt', mimeType: args._testMimeType || 'text/plain' },
    };
  });
  mockFilesCreate.mockReset().mockResolvedValue({
    data: { id: 'f-uploaded', name: 'uploaded.pdf', mimeType: 'application/pdf', size: '5000' },
  });
  mockFilesExport.mockReset().mockImplementation(async () => {
    const stream = new PassThrough();
    setTimeout(() => { stream.end('exported-content'); }, 5);
    return { data: stream };
  });
  mockFilesDelete.mockReset().mockResolvedValue({});
  mockCreateReadStream.mockReset().mockImplementation(() => new PassThrough());
  mockCreateWriteStream.mockReset().mockImplementation(() => {
    const stream = new PassThrough();
    (stream as any).path = '/tmp/test-output.txt';
    return stream;
  });
}
