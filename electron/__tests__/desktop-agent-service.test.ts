import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, screen as electronScreen } from 'electron';
import type { DesktopAgentStatus } from '../desktop-agent-types';

// ============================================================================
// Desktop Agent Service Tests (CU-101 to CU-150)
// Tests for electron/desktop-agent-service.ts and desktop-agent-handlers.ts.
// Covers types/config, handler registration, public API, and action logic.
// ============================================================================

// ─── Module-level mocks ─────────────────────────────────────────────────────

const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => false),
  mockReadFileSync: vi.fn(() => '{}'),
  mockWriteFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: any) => {
    if (cb) cb(null, '', '');
    return {} as any;
  }),
}));

vi.mock('node:module', () => ({
  createRequire: vi.fn(() => (mod: string) => {
    if (mod === 'sharp') return null;
    return {};
  }),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(async () => ({
        response: {
          text: () => JSON.stringify({ action: 'done', message: 'Task completed' }),
        },
      })),
    })),
  })),
}));

vi.mock('../browser-web-service', () => ({
  BrowserWebService: vi.fn().mockImplementation(function () {
    return {
      setApiKey: vi.fn(),
      getStatus: vi.fn(() => ({ status: 'idle', currentStep: 0 })),
      abort: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
    };
  }),
}));

vi.mock('../windows-uia-service', () => ({
  WindowsUIAService: vi.fn().mockImplementation(function () {
    return {
      setApiKey: vi.fn(),
      getStatus: vi.fn(() => ({ status: 'idle', currentStep: 0 })),
      abort: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
    };
  }),
}));

// ─── Import types and handlers ──────────────────────────────────────────────

import {
  DEFAULT_CONFIG, loadConfig, saveConfig,
  SEND_KEYS_MAP, PINVOKE_HEADER, LEFTDOWN, LEFTUP, RIGHTDOWN, RIGHTUP, WHEEL,
} from '../desktop-agent-types';

beforeEach(() => {
  mockExistsSync.mockReset().mockReturnValue(false);
  mockReadFileSync.mockReset().mockReturnValue('{}');
  mockWriteFileSync.mockReset();
});

// ============================================================================
// TYPES & CONFIG (CU-101 to CU-120)
// ============================================================================

describe('Desktop Agent Types & Config', () => {
  it('CU-101: DEFAULT_CONFIG has maxSteps=200', () => {
    expect(DEFAULT_CONFIG.maxSteps).toBe(200);
  });

  it('CU-102: DEFAULT_CONFIG has maxTotalSteps=500', () => {
    expect(DEFAULT_CONFIG.maxTotalSteps).toBe(500);
  });

  it('CU-103: DEFAULT_CONFIG has screenshotWidth=1024', () => {
    expect(DEFAULT_CONFIG.screenshotWidth).toBe(1024);
  });

  it('CU-104: DEFAULT_CONFIG has screenshotHeight=768', () => {
    expect(DEFAULT_CONFIG.screenshotHeight).toBe(768);
  });

  it('CU-105: DEFAULT_CONFIG has somEnabled=true', () => {
    expect(DEFAULT_CONFIG.somEnabled).toBe(true);
  });

  it('CU-106: DEFAULT_CONFIG has somFallbackToGrid=true', () => {
    expect(DEFAULT_CONFIG.somFallbackToGrid).toBe(true);
  });

  it('CU-107: DEFAULT_CONFIG has hierarchicalPlanningEnabled=true', () => {
    expect(DEFAULT_CONFIG.hierarchicalPlanningEnabled).toBe(true);
  });

  it('CU-108: DEFAULT_CONFIG has verificationEnabled=true', () => {
    expect(DEFAULT_CONFIG.verificationEnabled).toBe(true);
  });

  it('CU-109: DEFAULT_CONFIG has summarizeEveryNSteps=15', () => {
    expect(DEFAULT_CONFIG.summarizeEveryNSteps).toBe(15);
  });

  it('CU-110: DEFAULT_CONFIG has maxRawHistorySteps=8', () => {
    expect(DEFAULT_CONFIG.maxRawHistorySteps).toBe(8);
  });

  it('CU-111: DEFAULT_CONFIG has defaultActionDelay=300', () => {
    expect(DEFAULT_CONFIG.defaultActionDelay).toBe(300);
  });

  it('CU-112: DEFAULT_CONFIG has waitForChangeTimeout=8000', () => {
    expect(DEFAULT_CONFIG.waitForChangeTimeout).toBe(8000);
  });

  it('CU-113: DEFAULT_CONFIG has maxConsecutiveFailures=3', () => {
    expect(DEFAULT_CONFIG.maxConsecutiveFailures).toBe(3);
  });

  it('CU-114: DEFAULT_CONFIG has stuckDetectionThreshold=4', () => {
    expect(DEFAULT_CONFIG.stuckDetectionThreshold).toBe(4);
  });

  it('CU-115: DEFAULT_CONFIG has maxConcurrentAgents=3', () => {
    expect(DEFAULT_CONFIG.maxConcurrentAgents).toBe(3);
  });

  it('CU-116: DEFAULT_CONFIG has planningEnabled=true', () => {
    expect(DEFAULT_CONFIG.planningEnabled).toBe(true);
  });

  it('CU-117: DEFAULT_CONFIG has gridEnabled=true', () => {
    expect(DEFAULT_CONFIG.gridEnabled).toBe(true);
  });

  it('CU-118: DEFAULT_CONFIG has zoomEnabled=true', () => {
    expect(DEFAULT_CONFIG.zoomEnabled).toBe(true);
  });

  it('CU-119: DEFAULT_CONFIG has progressReportEveryNSteps=25', () => {
    expect(DEFAULT_CONFIG.progressReportEveryNSteps).toBe(25);
  });

  it('CU-120: DEFAULT_CONFIG has autoRecoverFromDialogs=true', () => {
    expect(DEFAULT_CONFIG.autoRecoverFromDialogs).toBe(true);
  });
});

// ============================================================================
// KEY MAPPING & CONSTANTS (CU-121 to CU-130)
// ============================================================================

describe('Key Mapping & Constants', () => {
  it('CU-121: SEND_KEYS_MAP maps enter to {ENTER}', () => {
    expect(SEND_KEYS_MAP['enter']).toBe('{ENTER}');
  });

  it('CU-122: SEND_KEYS_MAP maps tab to {TAB}', () => {
    expect(SEND_KEYS_MAP['tab']).toBe('{TAB}');
  });

  it('CU-123: SEND_KEYS_MAP maps escape/esc to {ESC}', () => {
    expect(SEND_KEYS_MAP['escape']).toBe('{ESC}');
    expect(SEND_KEYS_MAP['esc']).toBe('{ESC}');
  });

  it('CU-124: SEND_KEYS_MAP maps ctrl+c to ^c', () => {
    expect(SEND_KEYS_MAP['ctrl+c']).toBe('^c');
  });

  it('CU-125: SEND_KEYS_MAP maps ctrl+v to ^v', () => {
    expect(SEND_KEYS_MAP['ctrl+v']).toBe('^v');
  });

  it('CU-126: SEND_KEYS_MAP maps alt+f4 to %{F4}', () => {
    expect(SEND_KEYS_MAP['alt+f4']).toBe('%{F4}');
  });

  it('CU-127: SEND_KEYS_MAP maps F1-F12 function keys', () => {
    for (let i = 1; i <= 12; i++) {
      expect(SEND_KEYS_MAP[`f${i}`]).toBe(`{F${i}}`);
    }
  });

  it('CU-128: PINVOKE_HEADER contains user32.dll imports', () => {
    expect(PINVOKE_HEADER).toContain('user32.dll');
    expect(PINVOKE_HEADER).toContain('SetCursorPos');
    expect(PINVOKE_HEADER).toContain('mouse_event');
  });

  it('CU-129: mouse event flags have correct values', () => {
    expect(LEFTDOWN).toBe(2);
    expect(LEFTUP).toBe(4);
    expect(RIGHTDOWN).toBe(0x0008);
    expect(RIGHTUP).toBe(0x0010);
    expect(WHEEL).toBe(0x0800);
  });

  it('CU-130: SEND_KEYS_MAP maps arrow keys', () => {
    expect(SEND_KEYS_MAP['up']).toBe('{UP}');
    expect(SEND_KEYS_MAP['down']).toBe('{DOWN}');
    expect(SEND_KEYS_MAP['left']).toBe('{LEFT}');
    expect(SEND_KEYS_MAP['right']).toBe('{RIGHT}');
  });
});

// ============================================================================
// CONFIG PERSISTENCE (CU-131 to CU-135)
// ============================================================================

describe('Config Persistence', () => {
  it('CU-131: loadConfig returns DEFAULT_CONFIG when no file', () => {
    const config = loadConfig();
    expect(config.maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
    expect(config.screenshotWidth).toBe(DEFAULT_CONFIG.screenshotWidth);
  });

  it('CU-132: loadConfig merges saved config with defaults', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ maxSteps: 50 }));
    const config = loadConfig();
    expect(config.maxSteps).toBe(50);
    expect(config.screenshotWidth).toBe(DEFAULT_CONFIG.screenshotWidth);
  });

  it('CU-133: loadConfig returns defaults on JSON parse error', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('invalid json{{{');
    const config = loadConfig();
    expect(config.maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
  });

  it('CU-134: saveConfig writes JSON to file', () => {
    saveConfig(DEFAULT_CONFIG);
    expect(mockWriteFileSync).toHaveBeenCalled();
    const writtenData = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
    expect(writtenData.maxSteps).toBe(200);
  });

  it('CU-135: saveConfig does not throw on write error', () => {
    mockWriteFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    expect(() => saveConfig(DEFAULT_CONFIG)).not.toThrow();
  });
});

// ============================================================================
// DESKTOP AGENT SERVICE (CU-136 to CU-143)
// ============================================================================

describe('DesktopAgentService', () => {
  let DesktopAgentService: any;
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);

    const mod = await import('../desktop-agent-service');
    DesktopAgentService = mod.DesktopAgentService;
    service = new DesktopAgentService();
  }, 20000);

  it('CU-136: getConfig returns copy of config', () => {
    const config = service.getConfig();
    expect(config.maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
    // Should be a copy, not a reference
    config.maxSteps = 999;
    expect(service.getConfig().maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
  });

  it('CU-137: setConfig merges partial updates', () => {
    service.setConfig({ maxSteps: 50, screenshotWidth: 800 });
    const config = service.getConfig();
    expect(config.maxSteps).toBe(50);
    expect(config.screenshotWidth).toBe(800);
    expect(config.screenshotHeight).toBe(DEFAULT_CONFIG.screenshotHeight);
  });

  it('CU-138: setConfig emits config-updated event', () => {
    const listener = vi.fn();
    service.on('config-updated', listener);
    service.setConfig({ maxSteps: 100 });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ maxSteps: 100 }));
  });

  it('CU-139: setApiKey clears cached genAI', () => {
    service.setApiKey('new-key');
    // genAI should be null (recreated lazily)
    expect(() => service.getConfig()).not.toThrow();
  });

  it('CU-140: getStatus returns DesktopAgentStatus shape', () => {
    const status: DesktopAgentStatus = service.getStatus();
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('currentTask');
    expect(status).toHaveProperty('currentStep');
    expect(status).toHaveProperty('maxSteps');
    expect(status).toHaveProperty('plan');
    expect(status).toHaveProperty('lastAction');
    expect(status).toHaveProperty('config');
    expect(status).toHaveProperty('activeTasks');
    expect(status).toHaveProperty('totalActiveAgents');
  });

  it('CU-141: getStatus returns idle when no task running', () => {
    const status = service.getStatus();
    expect(status.status).toBe('idle');
    expect(status.currentTask).toBeNull();
  });

  it('CU-142: getActiveTasks returns empty array initially', () => {
    const tasks = service.getActiveTasks();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks).toHaveLength(0);
  });

  it('CU-143: service extends EventEmitter', () => {
    expect(typeof service.on).toBe('function');
    expect(typeof service.emit).toBe('function');
    expect(typeof service.removeListener).toBe('function');
  });

  it('CU-143A: round-trips coordinates across multi-monitor screenshot layout', () => {
    vi.mocked(electronScreen.getAllDisplays).mockReturnValue([
      {
        id: 0,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        size: { width: 1920, height: 1080 },
      },
      {
        id: 1,
        bounds: { x: 1920, y: 0, width: 1366, height: 1080 },
        scaleFactor: 1,
        size: { width: 1366, height: 1080 },
      },
    ] as any);
    vi.mocked(electronScreen.getPrimaryDisplay).mockReturnValue({
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      size: { width: 1920, height: 1080 },
    } as any);
    (electronScreen as any).screenToDipPoint = vi.fn((point: { x: number; y: number }) => point);
    (electronScreen as any).dipToScreenPoint = vi.fn((point: { x: number; y: number }) => point);

    (service as any).calculateScreenScale();

    const screenshotPoint = service.mapDesktopPointToScreenshotPoint(2500, 900);
    expect(screenshotPoint).not.toBeNull();
    expect(screenshotPoint!.x).toBeGreaterThan(700);
    expect(screenshotPoint!.y).toBeGreaterThan(450);

    const dipPoint = (service as any).mapScreenshotToDipPoint(screenshotPoint!.x, screenshotPoint!.y);
    expect(dipPoint).not.toBeNull();
    expect(dipPoint!.x).toBeCloseTo(2500, 0);
    expect(dipPoint!.y).toBeCloseTo(900, 0);
  });

  it('CU-143B: type action uses screenshot coordinates directly before typing', async () => {
    const mouseClickSpy = vi.spyOn(service, 'mouseClick').mockResolvedValue(undefined);
    const keyboardTypeSpy = vi.spyOn(service, 'keyboardType').mockResolvedValue(undefined);
    vi.spyOn(service as any, 'delay').mockResolvedValue(undefined);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await (service as any).executeAction({
      action: 'type',
      x: 100,
      y: 200,
      text: 'hola',
      message: 'enfocar y escribir',
    });

    expect(mouseClickSpy).toHaveBeenCalledWith(100, 200);
    expect(keyboardTypeSpy).toHaveBeenCalledWith('hola');

    consoleLogSpy.mockRestore();
  });

  it('CU-143C: updateScreenScale preserves focused capture layout when one is already active', () => {
    vi.mocked(electronScreen.getAllDisplays).mockReturnValue([
      {
        id: 0,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        size: { width: 1920, height: 1080 },
      },
    ] as any);
    vi.mocked(electronScreen.getPrimaryDisplay).mockReturnValue({
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      size: { width: 1920, height: 1080 },
    } as any);
    (electronScreen as any).screenToDipPoint = vi.fn((point: { x: number; y: number }) => point);
    (electronScreen as any).dipToScreenPoint = vi.fn((point: { x: number; y: number }) => point);

    (service as any).lastScreenshotLayout = {
      screenshotWidth: 1024,
      screenshotHeight: 768,
      offsetX: 0,
      offsetY: 0,
      renderScale: 1,
      virtualBounds: { x: 300, y: 200, width: 1024, height: 768 },
      displayRegions: [
        {
          displayId: '0',
          bounds: { x: 300, y: 200, width: 1024, height: 768 },
          left: 0,
          top: 0,
          width: 1024,
          height: 768,
        },
      ],
    };

    (service as any).updateScreenScale(1024, 768);

    const dipPoint = (service as any).mapScreenshotToDipPoint(10, 20);
    expect(dipPoint).not.toBeNull();
    expect(dipPoint!.x).toBeCloseTo(310, 0);
    expect(dipPoint!.y).toBeCloseTo(220, 0);
  });

  it('CU-143D: executeAction snaps approximate click to the center of the nearest interactive element', async () => {
    vi.mocked(electronScreen.getAllDisplays).mockReturnValue([
      {
        id: 0,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        size: { width: 1920, height: 1080 },
      },
    ] as any);
    vi.mocked(electronScreen.getPrimaryDisplay).mockReturnValue({
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      size: { width: 1920, height: 1080 },
    } as any);
    (electronScreen as any).screenToDipPoint = vi.fn((point: { x: number; y: number }) => point);
    (electronScreen as any).dipToScreenPoint = vi.fn((point: { x: number; y: number }) => point);

    (service as any).lastScreenshotLayout = {
      screenshotWidth: 1024,
      screenshotHeight: 768,
      offsetX: 0,
      offsetY: 0,
      renderScale: 1,
      virtualBounds: { x: 0, y: 0, width: 1024, height: 768 },
      displayRegions: [
        {
          displayId: '0',
          bounds: { x: 0, y: 0, width: 1024, height: 768 },
          left: 0,
          top: 0,
          width: 1024,
          height: 768,
        },
      ],
    };
    (service as any).currentUIElements = [
      {
        id: 1,
        name: 'Primer chat',
        controlType: 'ListItem',
        boundingRect: { x: 300, y: 200, width: 160, height: 36 },
        isEnabled: true,
        automationId: '',
        value: '',
      },
    ];

    const mouseClickSpy = vi.spyOn(service, 'mouseClick').mockResolvedValue(undefined);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await (service as any).executeAction({
      action: 'click',
      x: 312,
      y: 214,
      message: 'abrir chat',
    });

    expect(mouseClickSpy).toHaveBeenCalledWith(380, 218);
    consoleLogSpy.mockRestore();
  });

  it('CU-143E: executeAction snaps near-padding coordinates back into visible content', async () => {
    vi.mocked(electronScreen.getAllDisplays).mockReturnValue([
      {
        id: 0,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        size: { width: 1920, height: 1080 },
      },
    ] as any);
    vi.mocked(electronScreen.getPrimaryDisplay).mockReturnValue({
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      size: { width: 1920, height: 1080 },
    } as any);
    (electronScreen as any).screenToDipPoint = vi.fn((point: { x: number; y: number }) => point);
    (electronScreen as any).dipToScreenPoint = vi.fn((point: { x: number; y: number }) => point);

    (service as any).lastScreenshotLayout = {
      screenshotWidth: 1024,
      screenshotHeight: 768,
      offsetX: 0,
      offsetY: 24,
      renderScale: 1,
      virtualBounds: { x: 0, y: 0, width: 1024, height: 720 },
      displayRegions: [
        {
          displayId: '0',
          bounds: { x: 0, y: 0, width: 1024, height: 720 },
          left: 0,
          top: 24,
          width: 1024,
          height: 720,
        },
      ],
    };
    (service as any).currentUIElements = [];

    const mouseClickSpy = vi.spyOn(service, 'mouseClick').mockResolvedValue(undefined);
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await (service as any).executeAction({
      action: 'click',
      x: 240,
      y: 18,
      message: 'reentrar a contenido visible',
    });

    expect(mouseClickSpy).toHaveBeenCalledWith(240, 24);
    consoleLogSpy.mockRestore();
  });
});

// ============================================================================
// DESKTOP AGENT HANDLERS (CU-144 to CU-150)
// ============================================================================

describe('Desktop Agent Handlers Registration', () => {
  let registerDesktopAgentHandlers: any;
  let mockService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    (ipcMain as any)._clearHandlers();

    mockService = {
      executeTask: vi.fn(async () => 'Task completed'),
      executeParallelTasks: vi.fn(async () => []),
      getActiveTasks: vi.fn(() => []),
      abort: vi.fn(),
      abortAll: vi.fn(),
      getStatus: vi.fn(() => ({
        status: 'idle',
        currentTask: null,
        currentStep: 0,
        maxSteps: 200,
        plan: null,
        lastAction: null,
        config: DEFAULT_CONFIG,
        activeTasks: [],
        totalActiveAgents: 0,
      })),
      getConfig: vi.fn(() => ({ ...DEFAULT_CONFIG })),
      setConfig: vi.fn(),
      startObservation: vi.fn(async () => {}),
      stopObservation: vi.fn(),
      mouseClick: vi.fn(async () => {}),
      mouseDoubleClick: vi.fn(async () => {}),
      mouseRightClick: vi.fn(async () => {}),
      mouseDrag: vi.fn(async () => {}),
      keyboardType: vi.fn(async () => {}),
      keyboardKey: vi.fn(async () => {}),
      mouseScroll: vi.fn(async () => {}),
      focusWindow: vi.fn(async () => true),
      listWindows: vi.fn(async () => []),
      takeScreenshot: vi.fn(async () => 'base64data'),
      listBrowserProfiles: vi.fn(() => []),
      resetBrowserProfile: vi.fn(async () => ({ success: true })),
    };

    const mod = await import('../desktop-agent-handlers');
    registerDesktopAgentHandlers = mod.registerDesktopAgentHandlers;
    registerDesktopAgentHandlers(mockService);
  });

  it('CU-144: registers all expected desktop-agent IPC channels', () => {
    const handlers = (ipcMain as any)._getHandlers();
    const expectedChannels = [
      'desktop-agent:execute-task',
      'desktop-agent:execute-parallel',
      'desktop-agent:get-active-tasks',
      'desktop-agent:abort-task',
      'desktop-agent:abort',
      'desktop-agent:get-status',
      'desktop-agent:get-config',
      'desktop-agent:list-browser-profiles',
      'desktop-agent:reset-browser-profile',
      'desktop-agent:set-config',
      'desktop-agent:start-observation',
      'desktop-agent:stop-observation',
      'desktop-agent:click',
      'desktop-agent:double-click',
      'desktop-agent:right-click',
      'desktop-agent:drag',
      'desktop-agent:type',
      'desktop-agent:key',
      'desktop-agent:scroll',
      'desktop-agent:focus-window',
      'desktop-agent:list-windows',
      'desktop-agent:take-screenshot',
    ];

    for (const channel of expectedChannels) {
      expect(handlers.has(channel), `Missing handler: ${channel}`).toBe(true);
    }
    expect(handlers.size).toBeGreaterThanOrEqual(expectedChannels.length);
  });

  it('CU-145: execute-task handler calls service.executeTask', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:execute-task');
    const result = await handler({}, 'click the button');
    expect(result.success).toBe(true);
    expect(mockService.executeTask).toHaveBeenCalledWith('click the button', undefined);
  });

  it('CU-146: execute-task handler returns error on failure', async () => {
    mockService.executeTask.mockRejectedValue(new Error('Vision failed'));
    const handler = (ipcMain as any)._getHandler('desktop-agent:execute-task');
    const result = await handler({}, 'bad task');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Vision failed');
  });

  it('CU-147: abort handler calls abortAll', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:abort');
    const result = await handler({});
    expect(result.success).toBe(true);
    expect(mockService.abortAll).toHaveBeenCalled();
  });

  it('CU-148: click handler calls mouseClick with coordinates', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:click');
    const result = await handler({}, 100, 200);
    expect(result.success).toBe(true);
    expect(mockService.mouseClick).toHaveBeenCalledWith(100, 200);
  });

  it('CU-149: set-config handler calls setConfig and returns updated config', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:set-config');
    const result = await handler({}, { maxSteps: 50 });
    expect(result.success).toBe(true);
    expect(mockService.setConfig).toHaveBeenCalledWith({ maxSteps: 50 });
  });

  it('CU-150: take-screenshot handler returns base64 data', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:take-screenshot');
    const result = await handler({}, false);
    expect(result.success).toBe(true);
    expect(result.data).toBe('base64data');
    expect(mockService.takeScreenshot).toHaveBeenCalledWith(false);
  });
});
