import type { WAMessage } from '@whiskeysockets/baileys';

export function getDocumentMessage(message: WAMessage) {
  const nestedDocument = (message.message as any)?.documentWithCaptionMessage?.message?.documentMessage;
  return message.message?.documentMessage || nestedDocument;
}

export function isDocumentMessage(message: WAMessage): boolean {
  return Boolean(getDocumentMessage(message));
}

export function hasIncomingMedia(message: WAMessage): boolean {
  return isDocumentMessage(message) || Boolean(
    message.message?.imageMessage ||
    message.message?.videoMessage ||
    message.message?.audioMessage,
  );
}

export function getIncomingText(message: WAMessage): string {
  return message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    '';
}
