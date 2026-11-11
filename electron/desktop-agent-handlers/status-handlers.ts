import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopRegister } from './authorized-registration';
export function registerDesktopAgentStatusHandlers(service: DesktopAgentService, register: DesktopRegister) {
  register('get-status', () => service.getStatus(), { raw: true });
  register('get-config', () => service.getConfig(), { raw: true });
  register('list-browser-profiles', () => ({ success: true, profiles: service.listBrowserProfiles() }));
  register('reset-browser-profile', (_ctx, profileId) => service.resetBrowserProfile(profileId), { effect: true });
  register('set-config', (_ctx, updates) => { service.setConfig(updates); return { success: true, config: service.getConfig() }; }, { effect: true });
}
