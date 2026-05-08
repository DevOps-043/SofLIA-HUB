import fs from 'node:fs/promises';
import path from 'node:path';
import { getMimeType } from './helpers';
import type { SendEmailParams } from './types';

export async function buildRawMessage(params: SendEmailParams): Promise<string> {
  const contentType = params.isHtml ? 'text/html' : 'text/plain';
  const toLine = params.to.join(', ');

  if (!params.attachmentPaths?.length) {
    return [
      `To: ${toLine}`,
      ...(params.cc?.length ? [`Cc: ${params.cc.join(', ')}`] : []),
      ...(params.bcc?.length ? [`Bcc: ${params.bcc.join(', ')}`] : []),
      `Subject: ${params.subject}`,
      `Content-Type: ${contentType}; charset=utf-8`,
      '',
      params.body,
    ].join('\r\n');
  }

  const boundary = `----=_SofLIA_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headerLines = [
    `To: ${toLine}`,
    ...(params.cc?.length ? [`Cc: ${params.cc.join(', ')}`] : []),
    ...(params.bcc?.length ? [`Bcc: ${params.bcc.join(', ')}`] : []),
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: ${contentType}; charset=utf-8`,
    '',
    params.body,
  ];

  const parts: string[] = [headerLines.join('\r\n')];

  for (const filePath of params.attachmentPaths) {
    try {
      const fileData = await fs.readFile(filePath);
      const fileName = path.basename(filePath);
      const base64Data = fileData.toString('base64');
      const mimeType = getMimeType(fileName);

      parts.push(
        [
          `--${boundary}`,
          `Content-Type: ${mimeType}; name="${fileName}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${fileName}"`,
          '',
          base64Data,
        ].join('\r\n'),
      );
    } catch (fileErr: any) {
      console.warn(`[GmailService] Could not attach ${filePath}: ${fileErr.message}`);
    }
  }

  parts.push(`--${boundary}--`);
  return parts.join('\r\n');
}
