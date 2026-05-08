import { vi } from 'vitest';

const proactiveTestMocks = vi.hoisted(() => {
  const mockGenerateContent = vi.fn().mockResolvedValue({
    response: { text: () => 'Mensaje proactivo generado por Gemini' },
  });

  return {
    mockExistsSync: vi.fn().mockReturnValue(false),
    mockReadFileSync: vi.fn().mockReturnValue('{}'),
    mockWriteFileSync: vi.fn(),
    mockExecAsync: vi.fn().mockResolvedValue({ stdout: '[]', stderr: '' }),
    mockGenerateContent,
    mockGetGenerativeModel: vi.fn().mockReturnValue({ generateContent: mockGenerateContent }),
    mockGetIssues: vi.fn().mockResolvedValue([]),
    mockGetProjects: vi.fn().mockResolvedValue([]),
    mockGetAllWhatsAppSessions: vi.fn().mockReturnValue([]),
  };
});

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp/test-userdata') },
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: (...args: any[]) => proactiveTestMocks.mockExistsSync(...args),
    readFileSync: (...args: any[]) => proactiveTestMocks.mockReadFileSync(...args),
    writeFileSync: (...args: any[]) => proactiveTestMocks.mockWriteFileSync(...args),
  },
  existsSync: (...args: any[]) => proactiveTestMocks.mockExistsSync(...args),
  readFileSync: (...args: any[]) => proactiveTestMocks.mockReadFileSync(...args),
  writeFileSync: (...args: any[]) => proactiveTestMocks.mockWriteFileSync(...args),
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: Function) => {
    cb(null, '[]', '');
    return { kill: vi.fn() };
  }),
  execSync: vi.fn().mockReturnValue(Buffer.from('')),
}));

vi.mock('node:util', () => ({ promisify: vi.fn(() => proactiveTestMocks.mockExecAsync) }));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: proactiveTestMocks.mockGetGenerativeModel,
  })),
}));

vi.mock('../../iris-data-main', () => ({
  getIssues: (...args: any[]) => proactiveTestMocks.mockGetIssues(...args),
  getProjects: (...args: any[]) => proactiveTestMocks.mockGetProjects(...args),
  getAllWhatsAppSessions: () => proactiveTestMocks.mockGetAllWhatsAppSessions(),
}));

const proactiveServiceModule = await vi.importActual<typeof import('../../proactive-service')>('../../proactive-service');

export const mockExistsSync = proactiveTestMocks.mockExistsSync;
export const mockReadFileSync = proactiveTestMocks.mockReadFileSync;
export const mockWriteFileSync = proactiveTestMocks.mockWriteFileSync;
export const mockExecAsync = proactiveTestMocks.mockExecAsync;
export const mockGenerateContent = proactiveTestMocks.mockGenerateContent;
export const mockGetGenerativeModel = proactiveTestMocks.mockGetGenerativeModel;
export const mockGetIssues = proactiveTestMocks.mockGetIssues;
export const mockGetProjects = proactiveTestMocks.mockGetProjects;
export const mockGetAllWhatsAppSessions = proactiveTestMocks.mockGetAllWhatsAppSessions;
export type ProactiveService = import('../../proactive-service').ProactiveService;
export const ProactiveService = proactiveServiceModule.ProactiveService;
