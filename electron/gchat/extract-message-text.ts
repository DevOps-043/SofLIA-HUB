import type { GChatService } from '../gchat-service.ts';

export function extractMessageText(this: GChatService, message: any): string {
    const candidates = [
      message?.text,
      message?.formattedText,
      message?.argumentText,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    const attachments = Array.isArray(message?.attachment)
      ? message.attachment
      : message?.attachment
        ? [message.attachment]
        : [];
    const attachmentNames = attachments
      .map((attachment: any) =>
        String(
          attachment?.contentName
          || attachment?.name
          || attachment?.attachmentDataRef?.resourceName
          || attachment?.contentType
          || '',
        ).trim())
      .filter(Boolean);
    if (attachmentNames.length > 0) {
      return `[Mensaje con adjunto: ${attachmentNames.join(', ')}]`;
    }

    if (Array.isArray(message?.cardsV2) && message.cardsV2.length > 0) {
      return '[Mensaje interactivo sin texto plano]';
    }

    const annotationUrls = Array.isArray(message?.annotations)
      ? message.annotations
        .map((annotation: any) => String(annotation?.richLinkMetadata?.uri || '').trim())
        .filter(Boolean)
      : [];
    if (annotationUrls.length > 0) {
      return annotationUrls.join(' ');
    }

    return '[Mensaje sin texto disponible]';
  }
