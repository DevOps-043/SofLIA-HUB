import type { GuidanceControl, GuidanceRequest, PracticeDefinition } from '../../src/shared/orb-guidance';
import type { PreloadBridge, SafeIpc } from './types';

export function exposeOrbGuidanceApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  bridge.exposeInMainWorld('orbGuidance', {
    getState: () => ipc.safeInvoke('orb:guidance-get'),
    showTarget: (request: GuidanceRequest) => ipc.safeInvoke('orb:guidance-show', request),
    control: (control: GuidanceControl) => ipc.safeInvoke('orb:guidance-control', control),
    startPractice: (definition: PracticeDefinition) => ipc.safeInvoke('orb:practice-start', definition),
    checkPractice: () => ipc.safeInvoke('orb:practice-check'),
    onState: (callback: (state: unknown) => void) => ipc.safeOn('orb:guidance-state', callback),
  });
}
