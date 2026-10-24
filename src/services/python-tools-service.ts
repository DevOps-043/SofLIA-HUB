// Wrapper tipado para los cinco canales concretos de documentos y privacidad.
import type { PythonToolsApi, PythonToolsStatusSnapshot, PrivacyConfigSnapshot, ParsedDocumentSnapshot, RedactionSnapshot, PrivacyConfig } from '../shared/python-tools';
export type { PrivacyConfig, DocumentTable, ParsedDocument, PiiEntity, RedactionResult, PythonToolsStatus, PythonToolsStatusSnapshot, PrivacyConfigSnapshot, ParsedDocumentSnapshot, RedactionSnapshot } from '../shared/python-tools';
declare global { interface Window { pythonTools?: PythonToolsApi } }
function api() {
  const bridge = window.pythonTools;
  if (!bridge) throw new Error('La API de herramientas Python no está disponible en este entorno.');
  return bridge;
}

export const pythonToolsService = {
  isAvailable(): boolean {
    return typeof window.pythonTools !== 'undefined';
  },
  getStatus(): Promise<PythonToolsStatusSnapshot> {
    return api().getStatus();
  },
  parseDocument(): Promise<ParsedDocumentSnapshot> {
    return api().parseDocument();
  },
  redactText(text: string): Promise<RedactionSnapshot> {
    return api().redactText(text);
  },
  getPrivacyConfig(): Promise<PrivacyConfigSnapshot> {
    return api().getPrivacyConfig();
  },
  setPrivacyConfig(updates: Partial<PrivacyConfig>): Promise<PrivacyConfigSnapshot> {
    return api().setPrivacyConfig(updates);
  },
};

