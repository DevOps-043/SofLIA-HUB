/** Contratos públicos; las rutas del host y comandos Python son exclusivos de main. */
export const PYTHON_TOOLS_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const PYTHON_TOOLS_MAX_TEXT_CHARS = 400_000;
export const PYTHON_TOOLS_MAX_TABLES = 100;
export const PYTHON_TOOLS_MAX_CELLS = 20_000;
export interface PrivacyConfig { redactDocuments: boolean }
export interface DocumentTable { rows: string[][]; page?: number; sheet?: string; slide?: number; index?: number }
export interface DocumentMetadata {
  pages?: number; pagesParsed?: number; sheets?: number; slides?: number; paragraphs?: number; tables?: number;
  format?: 'pdf' | 'xlsx' | 'xlsm' | 'pptx' | 'docx'; sizeBytes?: number; truncated?: boolean; piiRedacted?: number; piiEngine?: string;
}
export interface ParsedDocument { markdown: string; tables: DocumentTable[]; metadata: DocumentMetadata }
export interface PiiEntity { type: string; start: number; end: number }
export interface RedactionResult { redacted: string; entities: PiiEntity[]; engine: string; redactedCount: number }
export interface PythonToolsStatus { available: boolean; running: boolean; lastError: string | null; privacy: PrivacyConfig }
export interface PythonToolsResult { success: boolean; error?: string; code?: string; cancelled?: boolean; uncertain?: boolean; recoveryRequired?: boolean; cleanupPending?: boolean }
export interface PythonToolsStatusSnapshot extends PythonToolsResult { status?: PythonToolsStatus }
export interface PrivacyConfigSnapshot extends PythonToolsResult { config?: PrivacyConfig }
export interface ParsedDocumentSnapshot extends PythonToolsResult { document?: ParsedDocument }
export interface RedactionSnapshot extends PythonToolsResult { redaction?: RedactionResult }
export interface PythonToolsApi {
  getStatus(): Promise<PythonToolsStatusSnapshot>;
  parseDocument(): Promise<ParsedDocumentSnapshot>;
  redactText(text: string): Promise<RedactionSnapshot>;
  getPrivacyConfig(): Promise<PrivacyConfigSnapshot>;
  setPrivacyConfig(updates: Partial<PrivacyConfig>): Promise<PrivacyConfigSnapshot>;
}
