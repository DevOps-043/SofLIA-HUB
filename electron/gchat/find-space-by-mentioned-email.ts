import type { GChatService, ChatSpace } from '../gchat-service.ts';

export async function findSpaceByMentionedEmail(this: GChatService, chat: any, spaces: ChatSpace[], hint: string): Promise<ChatSpace | null> {
    const normalizedHint = this.normalizeSearchText(hint);
    if (!normalizedHint || normalizedHint.length < 3) {
      return null;
    }

    const normalizedSelfEmail = this.normalizeSearchText(this.getConnectedGoogleEmail() || '');
    const triedEmails = new Set<string>();
    const candidateSpaces = [...spaces]
      .sort((left, right) => {
        const leftBot = left.singleUserBotDm ? 1 : 0;
        const rightBot = right.singleUserBotDm ? 1 : 0;
        if (leftBot !== rightBot) {
          return rightBot - leftBot;
        }
        return this.compareDateStringsDesc(left.lastActiveTime, right.lastActiveTime);
      })
      .slice(0, 16);

    for (const space of candidateSpaces) {
      try {
        const recentMessages = await this.listRecentRawMessages(
          chat,
          space.name,
          space.singleUserBotDm ? 200 : 80,
          space.singleUserBotDm ? 8 : 3,
        );

        for (const message of recentMessages) {
          const messageText = this.extractMessageText(message);
          const normalizedText = this.normalizeSearchText(messageText);
          if (!normalizedText || !normalizedText.includes(normalizedHint)) {
            continue;
          }

          const candidateEmails = [
            ...this.extractEmails(messageText),
            String(message?.sender?.email || '').trim(),
          ]
            .map((email) => this.normalizeSearchText(email))
            .filter(Boolean);

          for (const candidateEmail of candidateEmails) {
            if (
              triedEmails.has(candidateEmail)
              || (normalizedSelfEmail && candidateEmail === normalizedSelfEmail)
            ) {
              continue;
            }
            triedEmails.add(candidateEmail);

            const directMessage = await this.findDirectMessageByUserAlias(chat, `users/${candidateEmail}`);
            if (directMessage) {
              return directMessage;
            }
          }
        }
      } catch {
        // Ignore individual spaces that fail inspection and keep searching.
      }
    }

    return null;
  }
