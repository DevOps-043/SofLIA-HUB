import type { GChatService } from '../gchat-service.ts';

export function scoreMessageHintMatch(this: GChatService, messageText: string, normalizedHint: string, preferHumanDirectMessage: boolean, isSelfSender: boolean): number {
    const normalizedText = this.normalizeSearchText(messageText);
    if (!normalizedText || !normalizedText.includes(normalizedHint)) {
      return 0;
    }

    let score = isSelfSender ? 1 : (preferHumanDirectMessage ? 3 : 2);
    if (normalizedText.startsWith(normalizedHint)) {
      score += isSelfSender ? 2 : 7;
    }
    if (normalizedText.includes(`${normalizedHint} hernandez`) || normalizedText.includes(`${normalizedHint} martinez`)) {
      score += isSelfSender ? 2 : 6;
    }
    if (normalizedText.includes(`${normalizedHint} te invito`) || normalizedText.includes(`${normalizedHint} te invito a unirte`)) {
      score += isSelfSender ? 1 : 6;
    }
    if (normalizedText.includes(`${normalizedHint} compartio`) || normalizedText.includes(`${normalizedHint} compartio `)) {
      score += isSelfSender ? 1 : 5;
    }
    if (normalizedText.includes(`${normalizedHint} x `)) {
      score += isSelfSender ? 1 : 4;
    }
    if (new RegExp(`\\b${this.escapeRegExp(normalizedHint)}[^\\s]*@`, 'i').test(messageText)) {
      score += isSelfSender ? 2 : 8;
    }

    return score;
  }
