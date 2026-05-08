export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  body?: string;
  date: Date;
  labelIds: string[];
  isUnread: boolean;
}

export interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  isHtml?: boolean;
  attachmentPaths?: string[];
}

export interface GetMessagesOptions {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  pageToken?: string;
}

export interface GetMessagesResult {
  [key: string]: unknown;
  success: boolean;
  messages?: EmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  error?: string;
}
