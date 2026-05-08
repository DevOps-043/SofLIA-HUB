import { screen as electronScreen } from 'electron';
import { vi } from 'vitest';

export function mockSingleDisplay(): void {
  vi.mocked(electronScreen.getAllDisplays).mockReturnValue([{
    id: 0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    size: { width: 1920, height: 1080 },
  }] as any);
  mockPrimaryDisplay();
}

export function mockDualDisplay(): void {
  vi.mocked(electronScreen.getAllDisplays).mockReturnValue([
    { id: 0, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, size: { width: 1920, height: 1080 } },
    { id: 1, bounds: { x: 1920, y: 0, width: 1366, height: 1080 }, scaleFactor: 1, size: { width: 1366, height: 1080 } },
  ] as any);
  mockPrimaryDisplay();
}

function mockPrimaryDisplay(): void {
  vi.mocked(electronScreen.getPrimaryDisplay).mockReturnValue({
    id: 0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
    size: { width: 1920, height: 1080 },
  } as any);
  (electronScreen as any).screenToDipPoint = vi.fn((point: { x: number; y: number }) => point);
  (electronScreen as any).dipToScreenPoint = vi.fn((point: { x: number; y: number }) => point);
}

export function setLayout(service: any, layout: any): void {
  service.lastScreenshotLayout = layout;
}
