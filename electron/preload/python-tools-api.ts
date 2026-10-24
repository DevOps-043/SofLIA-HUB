import type { PythonToolsApi } from '../../src/shared/python-tools';
import type { PreloadBridge, SafeIpc } from './types';
export function exposePythonToolsApi(bridge: PreloadBridge, { safeInvoke }: SafeIpc): void {
  const api: PythonToolsApi = {
    getStatus: (...args) => safeInvoke('pytools:status', ...args),
    parseDocument: (...args) => safeInvoke('pytools:parse-document', ...args),
    redactText: (...args) => safeInvoke('pytools:redact-text', ...args),
    getPrivacyConfig: (...args) => safeInvoke('pytools:get-privacy-config', ...args),
    setPrivacyConfig: (...args) => safeInvoke('pytools:set-privacy-config', ...args),
  };
  bridge.exposeInMainWorld('pythonTools', api);
}
