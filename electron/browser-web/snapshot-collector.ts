import { collectBrowserDomSnapshot } from './snapshot-dom';
import type { Page } from 'playwright-core';
import { runBackendTaskStage } from '../desktop-agent/task-cancellation';
import { buildBrowserSnapshotSignature } from './snapshot-signature';
import type { BrowserPageSnapshot } from './types';

export async function collectBrowserPageSnapshot(page: Page, signal?: AbortSignal): Promise<BrowserPageSnapshot> {
  const title = await runBackendTaskStage(signal, () => page.title().catch(() => ''));
  const url = page.url();
  const screenshotBuffer = await runBackendTaskStage(signal, () => page.screenshot({ type: 'png', animations: 'disabled' }).catch(() => null));
  const screenshotBase64 = screenshotBuffer ? Buffer.from(screenshotBuffer).toString('base64') : '';
  const domSnapshot = await runBackendTaskStage(signal, () => collectBrowserDomSnapshot(page));

  const snapshot: BrowserPageSnapshot = {
    url,
    title,
    textExcerpt: domSnapshot?.textExcerpt || '',
    elements: Array.isArray(domSnapshot?.elements) ? domSnapshot.elements : [],
    screenshotBase64,
    scrollY: typeof domSnapshot?.scrollY === 'number' ? domSnapshot.scrollY : 0,
    activeRef: typeof domSnapshot?.activeRef === 'string' ? domSnapshot.activeRef : '',
    signature: '',
  };

  snapshot.signature = buildBrowserSnapshotSignature(snapshot);
  return snapshot;
}
