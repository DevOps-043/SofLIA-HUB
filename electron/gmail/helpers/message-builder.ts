import type { EmailMessage } from '../types';
import { extractBodyFromPart, type MessagePart } from './message-body';

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
    headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    id: detail.data.id || '',
    threadId: detail.data.threadId || '',
    from: getHeader('From'),
    to: getHeader('To').split(',').map((value) => value.trim()).filter(Boolean),
    subject: getHeader('Subject'),
    snippet: detail.data.snippet || '',
    body: extractBodyFromPart(detail.data.payload),
    date: new Date(getHeader('Date') || detail.data.internalDate || ''),
    labelIds: detail.data.labelIds || [],
    isUnread: (detail.data.labelIds || []).includes('UNREAD'),
  };
}
