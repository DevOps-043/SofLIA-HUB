import { normalizeOutgoingWhatsAppText } from '../whatsapp-text';

export const formatForWhatsApp = (text: string, isGroup: boolean = false): string => {
  let result = normalizeOutgoingWhatsAppText(text);

  if (isGroup) {
    result = `[✨ *SofLIA*]: ${result}`;
  }

  result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');
  result = result.replace(/\*\*(.*?)\*\*/g, '*$1*');
  result = result.replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').trim());
  result = result.replace(/`([^`]+)`/g, '$1');
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  result = result.replace(/^\s*[-•]\s+/gm, '• ');
  result = result.replace(/\n{3,}/g, '\n\n');

  return normalizeOutgoingWhatsAppText(result).trim();
};
