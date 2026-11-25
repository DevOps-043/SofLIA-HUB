import { EventEmitter } from 'node:events';
import type { BrowserWindow, WebContentsView } from 'electron';
import { vi } from 'vitest';

export function mountComputerApprovalFixture(window: BrowserWindow, defaultApproval = false) {
  const events = new EventEmitter();
  const review = vi.fn<(html: string) => Promise<boolean>>().mockResolvedValue(defaultApproval);
  const remove = vi.fn();
  const attach = vi.fn((view: WebContentsView) => {
    const contents = view.webContents as typeof view.webContents & EventEmitter;
    const html = decodeURIComponent(contents.getURL().split(',')[1] || '');
    void review(html).then(approved => {
      contents.emit('will-navigate', {
        url: `https://computer-approval.invalid/${approved ? 'approve' : 'cancel'}`,
        preventDefault: vi.fn(),
      });
    });
  });
  Object.assign(window, {
    on: events.on.bind(events), once: events.once.bind(events), removeListener: events.removeListener.bind(events),
    getContentBounds: () => ({ x: 0, y: 0, width: 1000, height: 700 }),
    contentView: { addChildView: attach, removeChildView: remove },
  });
  return { review, attach, remove };
}
