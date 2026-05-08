import { beforeEach, describe, vi } from 'vitest';
import { registerWorkflowHubExecutionCases } from './workflow-hub/execution-cases';
import { registerWorkflowHubOverviewCases } from './workflow-hub/overview-cases';
import { registerWorkflowHubPassiveRuleCases } from './workflow-hub/passive-rule-cases';
import { registerWorkflowHubVariantCases } from './workflow-hub/variant-cases';

const {
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
  default: { existsSync: mockExistsSync, readFileSync: mockReadFileSync, writeFileSync: mockWriteFileSync, mkdirSync: mockMkdirSync },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

vi.mock('electron', () => ({ app: { getPath: mockGetPath } }));
vi.mock('../iris-data-main', () => ({ getSofiaUserByEmail: mockGetSofiaUserByEmail }));

describe('WorkflowHubService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
    mockGetPath.mockReturnValue('C:/tmp/soflia-tests');
    mockGetSofiaUserByEmail.mockResolvedValue(null);
  });

  registerWorkflowHubOverviewCases();
  registerWorkflowHubExecutionCases();
  registerWorkflowHubVariantCases();
  registerWorkflowHubPassiveRuleCases();
});
