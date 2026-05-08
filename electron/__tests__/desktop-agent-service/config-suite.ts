import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, loadConfig, mockExistsSync, mockReadFileSync, mockWriteFileSync, saveConfig } from './fixture';

describe('Config Persistence', () => {
  it('CU-131: loadConfig returns DEFAULT_CONFIG when no file', () => {
    const config = loadConfig();
    expect(config.maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
    expect(config.screenshotWidth).toBe(DEFAULT_CONFIG.screenshotWidth);
  });

  it('CU-132: loadConfig merges saved config with defaults', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ maxSteps: 50 }));
    expect(loadConfig().maxSteps).toBe(50);
    expect(loadConfig().screenshotWidth).toBe(DEFAULT_CONFIG.screenshotWidth);
  });

  it('CU-133: loadConfig returns defaults on JSON parse error', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('invalid json{{{');
    expect(loadConfig().maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
  });

  it('CU-134: saveConfig writes JSON to file', () => {
    saveConfig(DEFAULT_CONFIG);
    expect(JSON.parse(mockWriteFileSync.mock.calls[0][1]).maxSteps).toBe(200);
  });

  it('CU-135: saveConfig does not throw on write error', () => {
    mockWriteFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    expect(() => saveConfig(DEFAULT_CONFIG)).not.toThrow();
  });
});
