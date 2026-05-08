export interface MessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: MessagePart[];
}

export function decodeBody(data?: string | null): string {
  if (!data) return '';
  try {
    return Buffer.from(data, 'base64url').toString('utf-8');
  } catch {
    return '';
  }
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
