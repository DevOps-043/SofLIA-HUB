export function quickScreenshotHash(base64: string): string {
  const sample = base64.slice(0, 4000);
  let hash = 0;
  for (let index = 0; index < sample.length; index++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(index);
    hash |= 0;
  }
  return hash.toString(36);
}

export async function waitForScreenHashChange(input: {
  timeoutMs: number;
  intervalMs: number;
  takeScreenshot: () => Promise<string>;
  delay: (ms: number) => Promise<void>;
}): Promise<boolean> {
  const beforeHash = quickScreenshotHash(await input.takeScreenshot());
  const start = Date.now();
  while (Date.now() - start < input.timeoutMs) {
    await input.delay(input.intervalMs);
    if (quickScreenshotHash(await input.takeScreenshot()) !== beforeHash) return true;
  }
  return false;
}

export async function waitForWindowTitle(input: {
  titleSubstring: string;
  timeoutMs: number;
  listWindows: () => Promise<Array<{ title: string }>>;
  delay: (ms: number) => Promise<void>;
}): Promise<boolean> {
  const start = Date.now();
  const expectedTitle = input.titleSubstring.toLowerCase();
  while (Date.now() - start < input.timeoutMs) {
    const windows = await input.listWindows();
    if (windows.some(window => window.title.toLowerCase().includes(expectedTitle))) return true;
    await input.delay(500);
  }
  return false;
}
