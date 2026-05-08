import type { GoogleExportInfo } from './types';

export const GOOGLE_EXPORT_MAP_TEXT: Record<string, GoogleExportInfo> = {
  'application/vnd.google-apps.document': { mimeType: 'text/plain', ext: '.txt' },
  'application/vnd.google-apps.spreadsheet': { mimeType: 'text/csv', ext: '.csv' },
  'application/vnd.google-apps.presentation': { mimeType: 'text/plain', ext: '.txt' },
  'application/vnd.google-apps.drawing': { mimeType: 'image/png', ext: '.png' },
};

export const GOOGLE_EXPORT_MAP_PDF: Record<string, GoogleExportInfo> = {
  'application/vnd.google-apps.document': { mimeType: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: '.xlsx',
  },
  'application/vnd.google-apps.presentation': { mimeType: 'application/pdf', ext: '.pdf' },
  'application/vnd.google-apps.drawing': { mimeType: 'image/png', ext: '.png' },
};

export const TEXT_EXPORT_EXTENSIONS = ['.txt', '.csv', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts'];
