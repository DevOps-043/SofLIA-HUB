import { collectBrowserDomSnapshot } from './snapshot-dom';
import { buildBrowserSnapshotSignature } from './snapshot-signature';
import type { BrowserPageSnapshot } from './types';

export async function collectBrowserPageSnapshot(page: any): Promise<BrowserPageSnapshot> {
  const title = await page.title().catch(() => '');
  const url = page.url();
  const screenshotBuffer = await page.screenshot({ type: 'png', animations: 'disabled' }).catch(() => null);
  const screenshotBase64 = screenshotBuffer ? Buffer.from(screenshotBuffer).toString('base64') : '';
  const domSnapshot = await collectBrowserDomSnapshot(page);

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
