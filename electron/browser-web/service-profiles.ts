import fs from 'node:fs';
import {
  getBrowserProfileDirectory,
  getBrowserWebProfilesBaseDir,
  resolveBrowserProfileId,
  sanitizeBrowserProfileId,
} from './artifacts';
import type { BrowserProfileDescriptor } from './types';
import type { BrowserWebConstructor, BrowserWebProfileApi } from './service-types';

export function attachBrowserWebProfiles(Service: BrowserWebConstructor): void {
  Object.assign(Service.prototype, {
    listProfiles() {
      const profilesRoot = this.getProfilesBaseDir();
      const descriptors: BrowserProfileDescriptor[] = [];
      const pushDescriptor = (id: string, exists: boolean) => {
        const profilePath = this.getProfileDirectory(id);
        let lastModifiedAt: string | null = null;
        if (exists) {
          try {
            lastModifiedAt = fs.statSync(profilePath).mtime.toISOString();
          } catch {
            lastModifiedAt = null;
          }
        }
        descriptors.push({ id, path: profilePath, exists, lastModifiedAt });
      };
      pushDescriptor('default', fs.existsSync(this.getProfileDirectory('default')));
      if (fs.existsSync(profilesRoot)) {
        for (const entry of fs.readdirSync(profilesRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const id = this.sanitizeProfileId(entry.name);
          if (!id || id === 'default' || descriptors.some((item) => item.id === id)) continue;
          pushDescriptor(id, true);
        }
      }
      return descriptors.sort((left, right) => left.id.localeCompare(right.id));
    },
    async resetProfile(profileId: string) {
      const sanitizedId = this.resolveProfileId(profileId);
      const profilePath = this.getProfileDirectory(sanitizedId);
      if (this.currentProfileMode === 'persistent' && this.currentProfileId === sanitizedId) {
        await this.disposeBrowserResources();
      }
      let removed = false;
      if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
        removed = true;
      }
      return { success: true, profileId: sanitizedId, path: profilePath, removed };
    },
    getProfilesBaseDir: () => getBrowserWebProfilesBaseDir(),
    sanitizeProfileId: (profileId: string) => sanitizeBrowserProfileId(profileId),
    resolveProfileId: (profileId?: string) => resolveBrowserProfileId(profileId),
    getProfileDirectory: (profileId: string) => getBrowserProfileDirectory(profileId),
  } satisfies BrowserWebProfileApi & ThisType<any>);
}
