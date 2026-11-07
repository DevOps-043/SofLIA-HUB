import type { PreloadBridge, SafeIpc } from './types';
import type { AuthStateBridge } from '../../src/shared/auth-state';

export type { AuthStatePublication as RendererAuthState } from '../../src/shared/auth-state';

// Superficie minima: el renderer publica su estado de sesion para que el main
// pueda negar por defecto las funciones sensibles. Los tokens solo viajan de
// renderer a main y nunca forman parte de la respuesta observable.
export function exposeAuthApis(bridge: PreloadBridge, safeIpc: SafeIpc): void {
  const { safeInvoke } = safeIpc;
  const api: AuthStateBridge = {
    setState: state => safeInvoke('auth:set-state', state),
    getState: () => safeInvoke('auth:get-state'),
  };
  bridge.exposeInMainWorld('authState', api);
}
