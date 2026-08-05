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

  it('CU-132B: loadConfig normaliza modelos heredados al runtime único', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      model: 'gemini-3.5-flash',
      fallbackModel: 'gemini-2.5-pro',
      computerUseModel: 'gemini-3.5-flash-lite',
    }));
    const config = loadConfig();
    expect(config.model).toBe('gemini-3.6-flash');
    expect(config.fallbackModel).toBe('gemini-3.6-flash');
    expect(config.computerUseModel).toBe('gemini-3.6-flash');
  });

  it('CU-133: loadConfig returns defaults on JSON parse error', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('invalid json{{{');
    expect(loadConfig().maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
  });

  it('CU-134: saveConfig writes JSON to file', () => {
    saveConfig(DEFAULT_CONFIG);
    expect(JSON.parse(mockWriteFileSync.mock.calls[0][1]).maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
  });

  it('CU-135: saveConfig does not throw on write error', () => {
    mockWriteFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    expect(() => saveConfig(DEFAULT_CONFIG)).not.toThrow();
  });
});
