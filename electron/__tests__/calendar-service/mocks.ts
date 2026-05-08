import { vi } from 'vitest';

export const MockOAuth2 = vi.fn();
export const mockEventsDelete = vi.fn();
export const mockEventsInsert = vi.fn();
export const mockEventsList = vi.fn();
export const mockEventsPatch = vi.fn();
export const mockExistsSync = vi.fn();
export const mockGenerateAuthUrl = vi.fn();
export const mockGetToken = vi.fn();
export const mockOAuth2On = vi.fn();
export const mockReadFileSync = vi.fn();
export const mockRefreshAccessToken = vi.fn();
export const mockSetCredentials = vi.fn();
export const mockUserinfoGet = vi.fn();
export const mockWriteFileSync = vi.fn();

vi.doMock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({ events: { list: mockEventsList, insert: mockEventsInsert, patch: mockEventsPatch, delete: mockEventsDelete } })),
    auth: { OAuth2: MockOAuth2 },
    oauth2: vi.fn(() => ({ userinfo: { get: mockUserinfoGet } })),
  },
}));

vi.doMock('node:fs', () => ({
  default: {
    existsSync: (filePath: string) => mockExistsSync(filePath),
    readFileSync: (filePath: string) => mockReadFileSync(filePath),
    writeFileSync: (filePath: string, data: string) => mockWriteFileSync(filePath, data),
    createReadStream: vi.fn(),
    createWriteStream: vi.fn(),
  },
  existsSync: (filePath: string) => mockExistsSync(filePath),
  readFileSync: (filePath: string) => mockReadFileSync(filePath),
  writeFileSync: (filePath: string, data: string) => mockWriteFileSync(filePath, data),
  createReadStream: vi.fn(),
  createWriteStream: vi.fn(),
}));

vi.doMock('node:http', () => ({
  default: { createServer: vi.fn(() => ({ listen: vi.fn(), close: vi.fn(), on: vi.fn() })) },
  createServer: vi.fn(() => ({ listen: vi.fn(), close: vi.fn(), on: vi.fn() })),
}));

export function resetCalendarMocks(): void {
  mockEventsList.mockReset().mockResolvedValue({
    data: {
      items: [{
        id: 'evt-1',
        summary: 'Standup',
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date(Date.now() + 3600_000).toISOString() },
        location: 'Zoom',
        description: 'Daily standup',
      }],
    },
  });
  mockEventsInsert.mockReset().mockResolvedValue({ data: { id: 'evt-new' } });
  mockEventsPatch.mockReset().mockResolvedValue({ data: { id: 'evt-1' } });
  mockEventsDelete.mockReset().mockResolvedValue({});
  mockSetCredentials.mockReset();
  mockGenerateAuthUrl.mockReset().mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1');
  mockGetToken.mockReset().mockResolvedValue({
    tokens: { access_token: 'at-fresh', refresh_token: 'rt-fresh', expiry_date: Date.now() + 3600_000 },
  });
  mockRefreshAccessToken.mockReset().mockResolvedValue({
    credentials: { access_token: 'at-refreshed', expiry_date: Date.now() + 3600_000 },
  });
  mockOAuth2On.mockReset();
  MockOAuth2.mockReset().mockReturnValue({
    setCredentials: mockSetCredentials,
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    refreshAccessToken: mockRefreshAccessToken,
    on: mockOAuth2On,
  });
  mockUserinfoGet.mockReset().mockResolvedValue({ data: { email: 'user@test.com' } });
  mockExistsSync.mockReset().mockReturnValue(false);
  mockReadFileSync.mockReset().mockReturnValue('[]');
  mockWriteFileSync.mockReset().mockReturnValue(undefined);
}
