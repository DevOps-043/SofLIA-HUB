// Wrapper del renderer para el sidecar de herramientas Python (documentos + PII).
// Todos los llamados van por IPC allowlisted (canales pytools:*).

export interface PrivacyConfig {
  /** Redactar la PII de los documentos antes de que lleguen al modelo. */
  redactDocuments: boolean;
}

export interface DocumentTable {
  rows: string[][];
  page?: number;
  sheet?: string;
  slide?: number;
  index?: number;
}

export interface ParsedDocument {
  markdown: string;
  tables: DocumentTable[];
  metadata: Record<string, unknown>;
}

export interface PiiEntity {
  type: string;
  start: number;
  end: number;
}

export interface RedactionResult {
  redacted: string;
  entities: PiiEntity[];
  engine: string;
  redactedCount: number;
}

export interface PythonToolsStatus {
  available: boolean;
  running: boolean;
  lastError: string | null;
  privacy: PrivacyConfig;
}

export interface PythonToolsStatusSnapshot {
  success: boolean;
  status?: PythonToolsStatus;
  error?: string;
}

export interface PrivacyConfigSnapshot {
  success: boolean;
  config?: PrivacyConfig;
  error?: string;
}

export interface ParsedDocumentSnapshot {
  success: boolean;
  document?: ParsedDocument;
  error?: string;
}

export interface RedactionSnapshot {
  success: boolean;
  redaction?: RedactionResult;
  error?: string;
}

declare global {
  interface Window {
    pythonTools?: {
      getStatus: () => Promise<PythonToolsStatusSnapshot>;
      parseDocument: (filePath: string) => Promise<ParsedDocumentSnapshot>;
      redactText: (text: string) => Promise<RedactionSnapshot>;
      getPrivacyConfig: () => Promise<PrivacyConfigSnapshot>;
      setPrivacyConfig: (updates: Partial<PrivacyConfig>) => Promise<PrivacyConfigSnapshot>;
    };
  }
}

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
  parseDocument(filePath: string): Promise<ParsedDocumentSnapshot> {
    return api().parseDocument(filePath);
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
