/** Identidad resuelta por main. Nunca se acepta desde argumentos del modelo. */
export interface DocumentBranding {
  organizationName: string;
  primary: string;
  secondary: string;
  accent: string;
  fontFamily?: string;
  logo?: { png: Uint8Array; width: number; height: number };
}
export interface PreparedDocumentBranding {
  brand?: DocumentBranding;
  notice: string | null;
  assertCurrent(): Promise<void>;
}
