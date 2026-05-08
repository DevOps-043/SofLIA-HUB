import { vi } from 'vitest';

export const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockMkdirSync,
  mockGetPath,
  mockGetSofiaUserByEmail,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => false),
  mockReadFileSync: vi.fn(() => '{}'),
  mockWriteFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockGetPath: vi.fn(() => 'C:/tmp/soflia-tests'),
  mockGetSofiaUserByEmail: vi.fn(async () => null),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

vi.mock('electron', () => ({ app: { getPath: mockGetPath } }));
vi.mock('../iris-data-main', () => ({ getSofiaUserByEmail: mockGetSofiaUserByEmail }));
