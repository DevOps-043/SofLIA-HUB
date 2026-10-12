import { documentReadingStyles } from './document-presentation';

/** El documento vive en un origen opaco; su CSP no concede red, IPC, formularios ni subframes. */
export function isolatedPreviewHtml(content: string, interactive: boolean): string {
  const policy = "default-src 'none'; script-src " + (interactive ? "'unsafe-inline'" : "'none'") + "; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return '<!doctype html><meta http-equiv="Content-Security-Policy" content="' + policy + '"><meta charset="utf-8"><style>' + documentReadingStyles() + 'a{pointer-events:none}</style><main class="document">' + content + '</main>';
}
