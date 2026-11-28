import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app, type BrowserWindow, type WebContentsView } from 'electron';
import { vi } from 'vitest';
import { systemCipher } from '../../storage/os-cipher';

export async function installComputerPermissionProfile() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'soflia-permisos-'));
  const defaultPath = vi.mocked(app.getPath).getMockImplementation();
  const location = vi.spyOn(app, 'getPath').mockImplementation(name => name === 'userData' ? root : defaultPath?.(name) ?? root);
  const available = vi.spyOn(systemCipher, 'available').mockResolvedValue(true);
  const encrypt = vi.spyOn(systemCipher, 'encrypt').mockImplementation(async value => Buffer.from(value, 'utf8'));
  const decrypt = vi.spyOn(systemCipher, 'decrypt').mockImplementation(async value => ({ result: value.toString('utf8'), shouldReEncrypt: false }));
  return { root, dispose: async () => {
    location.mockImplementation(defaultPath!);
    available.mockRestore(); encrypt.mockRestore(); decrypt.mockRestore();
    await rm(root, { recursive: true, force: true });
  } };
}

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
