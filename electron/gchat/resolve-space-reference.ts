import type { GChatService, ChatSpace } from '../gchat-service.ts';

export async function resolveSpaceReference(this: GChatService, chat: any, rawReference: string): Promise<{ name: string; space?: ChatSpace }> {
    const reference = String(rawReference || '').trim();
    if (!reference) {
      throw new Error('Debes indicar el chat o espacio de Google Chat.');
    }

    const cached = this.getCachedResolvedReference(reference);
    if (cached) {
      return { name: cached.name, space: cached };
    }

    if (reference.startsWith('spaces/')) {
      return { name: reference };
    }

    const spaceNameFromUrl = this.extractSpaceNameFromUrl(reference);
    if (spaceNameFromUrl) {
      const resolvedSpace = {
        name: spaceNameFromUrl,
        displayName: `Chat directo (${spaceNameFromUrl})`,
        type: 'DIRECT_MESSAGE',
        spaceType: 'DIRECT_MESSAGE',
      } satisfies ChatSpace;
      this.rememberResolvedReference(reference, resolvedSpace);
      return {
        name: spaceNameFromUrl,
        space: resolvedSpace,
      };
    }

    const userAlias = this.normalizeUserAlias(reference);
    if (userAlias) {
      const directMessage = await this.findDirectMessageByUserAlias(chat, userAlias);
      if (directMessage) {
        this.rememberResolvedReference(reference, directMessage);
        return { name: directMessage.name, space: directMessage };
      }
    }

    const spaces = await this.listSpacesInternal(chat);
    const directMatch = this.findSpaceByDisplayName(spaces, reference);
    if (directMatch) {
      this.rememberResolvedReference(reference, directMatch);
      return { name: directMatch.name, space: directMatch };
    }

    const participantMatch = await this.findSpaceByParticipantHint(chat, spaces, reference);
    if (participantMatch) {
      this.rememberResolvedReference(reference, participantMatch);
      return { name: participantMatch.name, space: participantMatch };
    }

    const emailDerivedMatch = await this.findSpaceByMentionedEmail(chat, spaces, reference);
    if (emailDerivedMatch) {
      this.rememberResolvedReference(reference, emailDerivedMatch);
      return { name: emailDerivedMatch.name, space: emailDerivedMatch };
    }

    throw new Error(`No pude resolver el chat "${reference}". Usa el correo del contacto, la URL del chat o el space_name.`);
  }
