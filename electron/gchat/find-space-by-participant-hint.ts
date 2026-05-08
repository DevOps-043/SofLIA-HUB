import type { GChatService, ChatSpace } from '../gchat-service.ts';

export async function findSpaceByParticipantHint(this: GChatService, chat: any, spaces: ChatSpace[], hint: string): Promise<ChatSpace | null> {
    const normalizedHint = this.normalizeSearchText(hint);
    if (!normalizedHint || normalizedHint.length < 3) {
      return null;
    }

    const prioritizedSpaces = [...spaces]
      .filter((space) => !space.singleUserBotDm)
      .sort((left, right) => {
        const leftIsDirect = this.isHumanDirectMessageSpace(left) ? 1 : 0;
        const rightIsDirect = this.isHumanDirectMessageSpace(right) ? 1 : 0;
        if (leftIsDirect !== rightIsDirect) {
          return rightIsDirect - leftIsDirect;
        }
        return this.compareDateStringsDesc(left.lastActiveTime, right.lastActiveTime);
      });
    const selfSenderIdentifiers = await this.detectSelfUserIdentifiers(chat, prioritizedSpaces);
    let bestMatch: { space: ChatSpace; score: number } | null = null;

    for (const space of prioritizedSpaces) {
      try {
        let score = 0;

        if (this.normalizeSearchText(space.displayName).includes(normalizedHint)) {
          score += 3;
        }

        if (this.isHumanDirectMessageSpace(space)) {
          score += 6;
        } else if (this.isDirectMessageSpace(space)) {
          score += 2;
        }

        const memberScore = await this.scoreSpaceMembers(chat, space, normalizedHint);
        score += memberScore;

        if (score < 8) {
          const recentMessages = await this.listRecentRawMessages(
            chat,
            space.name,
            this.isHumanDirectMessageSpace(space) ? 800 : 200,
            this.isHumanDirectMessageSpace(space) ? 16 : 4,
          );
          let bestMessageScore = 0;

          for (const message of recentMessages) {
            const senderDisplay = this.normalizeSearchText(this.resolveSenderDisplayName(message?.sender));
            const senderEmail = this.normalizeSearchText(message?.sender?.email || '');
            const senderName = this.normalizeSearchText(message?.sender?.name || '');
            const messageText = this.extractMessageText(message);
            const isSelfSender = selfSenderIdentifiers.has(senderName);

            let matchScore = 0;
            if (
              senderDisplay.includes(normalizedHint)
              || senderEmail.includes(normalizedHint)
              || senderName.includes(normalizedHint)
            ) {
              matchScore = isSelfSender ? 2 : 8;
            } else {
              matchScore = this.scoreMessageHintMatch(
                messageText,
                normalizedHint,
                this.isHumanDirectMessageSpace(space),
                isSelfSender,
              );
            }

            bestMessageScore = Math.max(bestMessageScore, matchScore);
          }

          score += bestMessageScore;
        }

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { space, score };
        }

        if (bestMatch && bestMatch.score >= 14 && this.isHumanDirectMessageSpace(bestMatch.space)) {
          return bestMatch.space;
        }
      } catch {
        // Ignore individual spaces that fail inspection and keep searching.
      }
    }

    return bestMatch && bestMatch.score >= 8 ? bestMatch.space : null;
  }
