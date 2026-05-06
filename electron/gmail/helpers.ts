/**
 * Helpers puros del paquete Gmail.
 *
 * Sin efectos secundarios, sin acceso a red ni filesystem. Esto los hace
 * trivialmente testeables y reusables.
 *
 * Categorías:
 *  - Validación de email
 *  - Detección de MIME por extensión
 *  - Parseo de cuerpo de mensaje (decodeBody, extractBodyFromPart)
 *  - Construcción de EmailMessage desde respuesta Gmail
 *  - Inferencia de etiqueta organizacional desde header `From`
 *  - Utilidades de string (sanitización, normalización, title case)
 *  - Chunking
 */

import path from 'node:path';
import { BRAND_LABELS, GENERIC_EMAIL_DOMAINS, SECOND_LEVEL_TLDS } from './constants';
import type { EmailMessage } from './types';

const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const ANGLE_EMAIL_REGEX = /<([^>]+)>/;
const PLAIN_EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * Validación estricta de email — rechaza inputs con CR/LF/comillas para
 * prevenir header injection en SMTP.
 */
export function isValidEmail(email: string): boolean {
  const match = email.match(ANGLE_EMAIL_REGEX);
  const extracted = match ? match[1].trim() : email.trim();

  if (!STRICT_EMAIL_REGEX.test(extracted)) return false;
  if (/[\r\n"]/.test(email)) return false;

  return true;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

export function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream';
}

export function decodeBody(data?: string | null): string {
  if (!data) return '';
  try {
    return Buffer.from(data, 'base64url').toString('utf-8');
  } catch {
    return '';
  }
}

interface MessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: MessagePart[];
}

export function extractBodyFromPart(part: MessagePart | undefined | null): string {
  if (!part) return '';

  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBody(part.body.data);
  }

  if (part.parts?.length) {
    for (const child of part.parts) {
      const nested = extractBodyFromPart(child);
      if (nested) return nested;
    }
  }

  if (part.mimeType === 'text/html' && part.body?.data) {
    return decodeBody(part.body.data);
  }

  if (part.body?.data) {
    return decodeBody(part.body.data);
  }

  return '';
}

interface MessageHeader {
  name?: string;
  value?: string;
}

interface RawGmailDetail {
  data: {
    id?: string;
    threadId?: string;
    snippet?: string;
    internalDate?: string;
    labelIds?: string[];
    payload?: {
      headers?: MessageHeader[];
    } & MessagePart;
  };
}

export function buildEmailMessage(detail: RawGmailDetail): EmailMessage {
  const headers = detail.data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    id: detail.data.id || '',
    threadId: detail.data.threadId || '',
    from: getHeader('From'),
    to: getHeader('To').split(',').map((s) => s.trim()).filter(Boolean),
    subject: getHeader('Subject'),
    snippet: detail.data.snippet || '',
    body: extractBodyFromPart(detail.data.payload),
    date: new Date(getHeader('Date') || detail.data.internalDate || ''),
    labelIds: detail.data.labelIds || [],
    isUnread: (detail.data.labelIds || []).includes('UNREAD'),
  };
}

/* ─── Sender grouping (para organización automática de Inbox) ─────── */

export function extractEmailAddress(rawValue: string): string {
  const angleMatch = rawValue.match(ANGLE_EMAIL_REGEX);
  if (angleMatch?.[1]) {
    return angleMatch[1].trim().toLowerCase();
  }

  const directMatch = rawValue.match(PLAIN_EMAIL_REGEX);
  return directMatch?.[0]?.trim().toLowerCase() || '';
}

export function cleanSenderDisplayName(rawValue: string, email: string): string {
  const withoutEmail = rawValue.replace(/<[^>]+>/g, '');
  const withoutQuotes = withoutEmail.replace(/^["'\s]+|["'\s]+$/g, '');
  const cleaned = withoutQuotes
    .replace(/\((via|mediante)[^)]+\)/gi, '')
    .replace(/\b(via|mediante)\s+.+$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) return cleaned;
  return email.split('@')[0] || rawValue.trim();
}

export function getBaseDomain(domain: string): string {
  const cleanDomain = domain.toLowerCase().trim();
  const parts = cleanDomain.split('.').filter(Boolean);
  if (parts.length <= 2) return cleanDomain;

  const lastTwo = parts.slice(-2).join('.');
  if (SECOND_LEVEL_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

export function normalizeGroupingKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toTitleCase(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function sanitizeLabelName(value: string): string {
  const trimmed = value
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return trimmed.slice(0, 225) || 'Otros';
}

const ROLE_LIKE_REGEX = /\b(google|workspace|alerts|billing|team|support|notifications?|docs|drive|calendar)\b/i;
const NOTIFICATION_REGEX = /\b(alerts|billing|team|support|notifications?)\b/i;
const PERSONAL_DOMAIN = 'google.com';

interface OrganizationLabel {
  groupKey: string;
  labelName: string;
  domain?: string;
}

function inferOrganizationLabel(displayName: string, baseDomain: string): OrganizationLabel {
  const cleanedDisplay = cleanSenderDisplayName(displayName, '');
  const lowerDisplay = cleanedDisplay.toLowerCase();
  const brandKey = baseDomain.split('.')[0] || baseDomain;
  const brandLabel =
    BRAND_LABELS.get(baseDomain) || BRAND_LABELS.get(brandKey) || toTitleCase(brandKey);

  const looksPersonLike =
    cleanedDisplay.split(/\s+/).length >= 2 && !ROLE_LIKE_REGEX.test(lowerDisplay);

  if ((baseDomain === PERSONAL_DOMAIN || GENERIC_EMAIL_DOMAINS.has(baseDomain)) && looksPersonLike) {
    const personLabel = sanitizeLabelName(cleanedDisplay);
    return {
      groupKey: `person:${normalizeGroupingKey(personLabel)}`,
      labelName: personLabel,
    };
  }

  if (cleanedDisplay && lowerDisplay.includes(brandLabel.toLowerCase())) {
    return { groupKey: `domain:${baseDomain}`, labelName: brandLabel, domain: baseDomain };
  }

  if (
    cleanedDisplay &&
    !GENERIC_EMAIL_DOMAINS.has(baseDomain) &&
    cleanedDisplay.length <= 32 &&
    !NOTIFICATION_REGEX.test(lowerDisplay)
  ) {
    return {
      groupKey: `domain:${baseDomain}`,
      labelName: sanitizeLabelName(cleanedDisplay),
      domain: baseDomain,
    };
  }

  return {
    groupKey: `domain:${baseDomain}`,
    labelName: sanitizeLabelName(brandLabel),
    domain: baseDomain,
  };
}

export interface MessageGrouping {
  groupKey: string;
  labelName: string;
  domain?: string;
  senderSample: string;
}

export function inferMessageGrouping(fromHeader: string): MessageGrouping {
  const email = extractEmailAddress(fromHeader);
  const displayName = cleanSenderDisplayName(fromHeader, email);
  const domain = email.includes('@') ? email.split('@')[1] : '';
  const baseDomain = domain ? getBaseDomain(domain) : '';

  if (baseDomain && !GENERIC_EMAIL_DOMAINS.has(baseDomain)) {
    return {
      ...inferOrganizationLabel(displayName, baseDomain),
      senderSample: displayName || email || fromHeader,
    };
  }

  const fallbackLabel = sanitizeLabelName(displayName || email.split('@')[0] || 'Otros');
  return {
    groupKey: `person:${normalizeGroupingKey(fallbackLabel)}`,
    labelName: fallbackLabel,
    domain: baseDomain || undefined,
    senderSample: displayName || email || fromHeader,
  };
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }
  return result;
}
