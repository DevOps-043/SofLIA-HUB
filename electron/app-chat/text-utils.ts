import { normalizeComparableText } from '../whatsapp-text';
import type { AppChatConversationSummary } from './types';

export function normalizeForMatch(value: string | null | undefined): string {
  return normalizeComparableText(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateSnippet(value: string | null | undefined, maxLength: number = 160): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export function sanitizeFileName(value: string): string {
  const trimmed = value.trim() || 'archivo';
  return trimmed.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function guessExtensionFromMime(mimeType: string | null | undefined): string {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('pdf')) return '.pdf';
  return '.bin';
}

export function buildImageAssetFileName(
  conversation: AppChatConversationSummary,
  messageCreatedAt: string,
  index: number,
  mimeType?: string | null,
): string {
  const base = sanitizeFileName(conversation.title || 'chat');
  const stamp = messageCreatedAt.replace(/[:.]/g, '-');
  return `${base}_${stamp}_img_${index + 1}${guessExtensionFromMime(mimeType)}`;
}
