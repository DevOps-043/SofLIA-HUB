import type { PreloadBridge, SafeIpc } from './types';

export interface RendererAuthState {
  authenticated: boolean;
  userId: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  sofiaAccessToken?: string | null;
}

// Superficie minima: el renderer publica su estado de sesion para que el main
// pueda negar por defecto las funciones sensibles. No viajan tokens ni PII.
export function exposeAuthApis(bridge: PreloadBridge, safeIpc: SafeIpc): void {
  const { safeInvoke } = safeIpc;
  bridge.exposeInMainWorld('authState', {
    setState: (state: RendererAuthState): Promise<{ ok: boolean; state: RendererAuthState }> =>
      safeInvoke('auth:set-state', state),
    getState: (): Promise<RendererAuthState> => safeInvoke('auth:get-state'),
  });
}
