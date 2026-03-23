/**
 * GChatService — Google Chat API integration.
 * Provides space listing, message send/read, and reaction capabilities.
 * Runs in the Electron main process.
 */
import { EventEmitter } from 'node:events';
import type { CalendarService } from './calendar-service';

// ─── Types ──────────────────────────────────────────────────────────

export interface ChatSpace {
  name: string;
  displayName: string;
  type: 'ROOM' | 'DM' | 'GROUP_CHAT' | string;
  spaceThreadingState?: string;
  spaceType?: string;
  spaceUri?: string;
  lastActiveTime?: string;
  singleUserBotDm?: boolean;
  joinedDirectHumanUserCount?: number;
}

export interface ChatMessage {
  name: string;
  sender: { name: string; displayName: string; email?: string };
  createTime: string;
  text: string;
  threadName?: string;
  urls?: string[];
}

// ─── GChatService ───────────────────────────────────────────────────

export class GChatService extends EventEmitter {
  private calendarService: CalendarService;
  private resolvedSpaceCache = new Map<string, ChatSpace>();
  private selfUserIdentifiers = new Set<string>();
  private selfUserDetectionDone = false;

  constructor(calendarService: CalendarService) {
    super();
    this.calendarService = calendarService;
  }

  // ─── List Spaces ──────────────────────────────────────────────────

  async listSpaces(): Promise<{ success: boolean; spaces?: ChatSpace[]; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });

      const spaces = await this.listSpacesInternal(chat);

      return { success: true, spaces };
    } catch (err: any) {
      console.error('[GChatService] ListSpaces error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Get Messages ─────────────────────────────────────────────────

  async getMessages(
    spaceName: string,
    maxResults?: number,
  ): Promise<{ success: boolean; messages?: ChatMessage[]; resolvedSpace?: ChatSpace; urls?: string[]; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });
      const resolved = await this.resolveSpaceReference(chat, spaceName);
      const rawMessages = await this.listRecentRawMessages(chat, resolved.name, maxResults || 25);

      const messages: ChatMessage[] = rawMessages
        .map((m: any) => {
          const text = this.extractMessageText(m);
          return {
            name: m.name || '',
            sender: {
              name: m.sender?.name || '',
              displayName: this.resolveSenderDisplayName(m.sender),
              email: m.sender?.email || undefined,
            },
            createTime: m.createTime || '',
            text,
            threadName: m.thread?.name || undefined,
            urls: this.extractUrls(text),
          };
        })
        .sort((left, right) => this.compareDateStringsDesc(left.createTime, right.createTime));

      const urls = Array.from(new Set(messages.flatMap((message) => message.urls || [])));

      return {
        success: true,
        resolvedSpace: resolved.space,
        messages,
        urls,
      };
    } catch (err: any) {
      console.error('[GChatService] GetMessages error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Send Message ─────────────────────────────────────────────────

  async sendMessage(
    spaceName: string,
    text: string,
    threadName?: string,
  ): Promise<{ success: boolean; messageName?: string; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });
      const resolved = await this.resolveSpaceReference(chat, spaceName);

      const requestBody: any = { text };
      if (threadName) {
        requestBody.thread = { name: threadName };
      }

      const response = await chat.spaces.messages.create({
        parent: resolved.name,
        requestBody,
      });

      console.log(`[GChatService] Message sent: ${response.data.name}`);
      return { success: true, messageName: response.data.name || undefined };
    } catch (err: any) {
      console.error('[GChatService] SendMessage error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Add Reaction ─────────────────────────────────────────────────

  async addReaction(
    messageName: string,
    emoji: string,
  ): Promise<{ success: boolean; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });

      await chat.spaces.messages.reactions.create({
        parent: messageName,
        requestBody: {
          emoji: { unicode: emoji },
        },
      });

      console.log(`[GChatService] Reaction added: ${emoji} on ${messageName}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GChatService] AddReaction error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ─── Get Space Members ────────────────────────────────────────────

  async getMembers(
    spaceName: string,
  ): Promise<{ success: boolean; members?: Array<{ name: string; displayName: string; email?: string }>; error?: string }> {
    const auth = await this.calendarService.getGoogleAuth();
    if (!auth) return { success: false, error: 'Google no conectado' };

    try {
      const { google } = await import('googleapis');
      const chat = google.chat({ version: 'v1', auth });
      const resolved = await this.resolveSpaceReference(chat, spaceName);

      const response = await chat.spaces.members.list({
        parent: resolved.name,
        pageSize: 100,
      });

      const members = (response.data.memberships || []).map((m: any) => ({
        name: m.member?.name || '',
        displayName: m.member?.displayName || '',
        email: m.member?.email || undefined,
      }));

      return { success: true, members };
    } catch (err: any) {
      console.error('[GChatService] GetMembers error:', err.message);
      return { success: false, error: err.message };
    }
  }

  private async listSpacesInternal(chat: any): Promise<ChatSpace[]> {
    const response = await chat.spaces.list({ pageSize: 100 });
    const spaces: ChatSpace[] = (response.data.spaces || []).map((space: any) => this.mapSpace(space));
    return this.sortSpaces(spaces);
  }

  private mapSpace(space: any): ChatSpace {
    return {
      name: space?.name || '',
      displayName: this.resolveSpaceDisplayName(space),
      type: space?.spaceType || space?.type || '',
      spaceType: space?.spaceType || undefined,
      spaceThreadingState: space?.spaceThreadingState || undefined,
      spaceUri: space?.spaceUri || undefined,
      lastActiveTime: space?.lastActiveTime || undefined,
      singleUserBotDm: Boolean(space?.singleUserBotDm),
      joinedDirectHumanUserCount: Number.isFinite(space?.membershipCount?.joinedDirectHumanUserCount)
        ? Number(space.membershipCount.joinedDirectHumanUserCount)
        : undefined,
    };
  }

  private resolveSpaceDisplayName(space: any): string {
    if (typeof space?.displayName === 'string' && space.displayName.trim()) {
      return space.displayName.trim();
    }

    if (space?.spaceType === 'DIRECT_MESSAGE') {
      return `Chat directo (${space?.name || 'sin identificar'})`;
    }

    if (typeof space?.name === 'string' && space.name.trim()) {
      return space.name.trim();
    }

    return 'Espacio sin nombre';
  }

  private sortSpaces(spaces: ChatSpace[]): ChatSpace[] {
    return [...spaces].sort((left, right) => {
      const byActivity = this.compareDateStringsDesc(left.lastActiveTime, right.lastActiveTime);
      if (byActivity !== 0) return byActivity;
      return 0;
    });
  }

  private compareDateStringsDesc(left?: string, right?: string): number {
    const leftTime = left ? Date.parse(left) : Number.NaN;
    const rightTime = right ? Date.parse(right) : Number.NaN;
    const leftValid = Number.isFinite(leftTime);
    const rightValid = Number.isFinite(rightTime);

    if (leftValid && rightValid) {
      return rightTime - leftTime;
    }
    if (leftValid) return -1;
    if (rightValid) return 1;
    return 0;
  }

  private async resolveSpaceReference(chat: any, rawReference: string): Promise<{ name: string; space?: ChatSpace }> {
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

  private normalizeUserAlias(reference: string): string | null {
    const value = String(reference || '').trim();
    if (!value) return null;

    if (value.startsWith('users/')) {
      return value;
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) {
      return `users/${value.toLowerCase()}`;
    }

    return null;
  }

  private extractSpaceNameFromUrl(reference: string): string | null {
    try {
      const parsed = new URL(reference);
      const directPathMatch = parsed.pathname.match(/\/(?:dm|room|space)\/([^/?#]+)/i);
      if (directPathMatch?.[1]) {
        return `spaces/${directPathMatch[1]}`;
      }

      const hash = parsed.hash || '';
      const hashMatch = hash.match(/\/(?:dm|room|space)\/([^/?#]+)/i);
      if (hashMatch?.[1]) {
        return `spaces/${hashMatch[1]}`;
      }
    } catch {
      return null;
    }

    return null;
  }

  private async findDirectMessageByUserAlias(chat: any, normalizedAlias: string): Promise<ChatSpace | null> {
    try {
      const response = await chat.spaces.findDirectMessage({ name: normalizedAlias });
      if (!response?.data?.name) {
        return null;
      }
      return this.mapSpace(response.data);
    } catch {
      return null;
    }
  }

  private getCachedResolvedReference(reference: string): ChatSpace | null {
    const key = this.normalizeSearchText(reference);
    if (!key) return null;
    return this.resolvedSpaceCache.get(key) || null;
  }

  private rememberResolvedReference(reference: string, space: ChatSpace): void {
    const normalizedReference = this.normalizeSearchText(reference);
    if (normalizedReference) {
      this.resolvedSpaceCache.set(normalizedReference, space);
    }

    const normalizedDisplayName = this.normalizeSearchText(space.displayName);
    if (normalizedDisplayName) {
      this.resolvedSpaceCache.set(normalizedDisplayName, space);
    }

    const normalizedSpaceName = this.normalizeSearchText(space.name);
    if (normalizedSpaceName) {
      this.resolvedSpaceCache.set(normalizedSpaceName, space);
    }
  }

  private findSpaceByDisplayName(spaces: ChatSpace[], hint: string): ChatSpace | null {
    const normalizedHint = this.normalizeSearchText(hint);
    if (!normalizedHint) return null;

    const exact = spaces.find((space) => this.normalizeSearchText(space.displayName) === normalizedHint);
    if (exact) return exact;

    const partial = spaces.find((space) => this.normalizeSearchText(space.displayName).includes(normalizedHint));
    return partial || null;
  }

  private async findSpaceByParticipantHint(chat: any, spaces: ChatSpace[], hint: string): Promise<ChatSpace | null> {
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

  private async findSpaceByMentionedEmail(chat: any, spaces: ChatSpace[], hint: string): Promise<ChatSpace | null> {
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

  private getConnectedGoogleEmail(): string | null {
    const googleConnection = this.calendarService
      .getConnections()
      .find((connection) => connection.provider === 'google' && connection.isActive && connection.email);

    return googleConnection?.email?.trim().toLowerCase() || null;
  }

  private isDirectMessageSpace(space: ChatSpace): boolean {
    return (space.spaceType || '').toUpperCase() === 'DIRECT_MESSAGE' || String(space.type).toUpperCase() === 'DM';
  }

  private isHumanDirectMessageSpace(space: ChatSpace): boolean {
    return this.isDirectMessageSpace(space)
      && !space.singleUserBotDm
      && (space.joinedDirectHumanUserCount === undefined || space.joinedDirectHumanUserCount >= 2);
  }

  private async scoreSpaceMembers(chat: any, space: ChatSpace, normalizedHint: string): Promise<number> {
    try {
      const response = await chat.spaces.members.list({
        parent: space.name,
        pageSize: 20,
      });

      const memberships = Array.isArray(response?.data?.memberships) ? response.data.memberships : [];
      let score = 0;

      for (const membership of memberships) {
        const displayName = this.normalizeSearchText(membership?.member?.displayName || '');
        const email = this.normalizeSearchText(membership?.member?.email || '');
        const name = this.normalizeSearchText(membership?.member?.name || '');

        if (displayName.includes(normalizedHint) || email.includes(normalizedHint) || name.includes(normalizedHint)) {
          score += 8;
        }
      }

      return score;
    } catch {
      return 0;
    }
  }

  private async listRecentRawMessages(chat: any, spaceName: string, limit: number, maxPages: number = 100): Promise<any[]> {
    const safeLimit = Math.max(1, Math.min(limit || 25, 1000));
    const tail: any[] = [];
    let pageToken: string | undefined;
    let pageCount = 0;

    do {
      const response = await chat.spaces.messages.list({
        parent: spaceName,
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      });

      const messages = Array.isArray(response?.data?.messages) ? response.data.messages : [];
      for (const message of messages) {
        tail.push(message);
        if (tail.length > safeLimit) {
          tail.shift();
        }
      }

      pageToken = response?.data?.nextPageToken || undefined;
      pageCount += 1;
    } while (pageToken && pageCount < maxPages);

    return tail.sort((left, right) => this.compareDateStringsDesc(left?.createTime, right?.createTime));
  }

  private async detectSelfUserIdentifiers(chat: any, spaces: ChatSpace[]): Promise<Set<string>> {
    if (this.selfUserDetectionDone) {
      return this.selfUserIdentifiers;
    }

    const senderPresence = new Map<string, number>();
    const candidateSpaces = spaces.filter((space) => this.isHumanDirectMessageSpace(space)).slice(0, 8);

    for (const space of candidateSpaces) {
      try {
        const recentMessages = await this.listRecentRawMessages(chat, space.name, 40, 4);
        const seenInSpace = new Set<string>();

        for (const message of recentMessages) {
          const senderId = this.normalizeSearchText(message?.sender?.name || '');
          if (senderId) {
            seenInSpace.add(senderId);
          }
        }

        for (const senderId of seenInSpace) {
          senderPresence.set(senderId, (senderPresence.get(senderId) || 0) + 1);
        }
      } catch {
        // Ignore spaces that can't be sampled.
      }
    }

    const ranked = [...senderPresence.entries()].sort((left, right) => right[1] - left[1]);
    if (ranked.length > 0) {
      const highestCount = ranked[0][1];
      for (const [senderId, count] of ranked) {
        if (count >= 2 && count >= highestCount - 1) {
          this.selfUserIdentifiers.add(senderId);
        }
      }
    }

    this.selfUserDetectionDone = true;
    return this.selfUserIdentifiers;
  }

  private scoreMessageHintMatch(
    messageText: string,
    normalizedHint: string,
    preferHumanDirectMessage: boolean,
    isSelfSender: boolean,
  ): number {
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

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private normalizeSearchText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveSenderDisplayName(sender: any): string {
    if (typeof sender?.displayName === 'string' && sender.displayName.trim()) {
      return sender.displayName.trim();
    }
    if (typeof sender?.email === 'string' && sender.email.trim()) {
      return sender.email.trim();
    }
    if (typeof sender?.name === 'string' && sender.name.trim()) {
      return sender.name.trim();
    }
    if (typeof sender?.type === 'string' && sender.type.trim()) {
      return sender.type === 'HUMAN' ? 'Usuario de Google Chat' : sender.type.trim();
    }
    return 'Remitente desconocido';
  }

  private extractMessageText(message: any): string {
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

  private extractUrls(text: string): string[] {
    if (!text) return [];

    const matches = text.match(/https?:\/\/[^\s<>"'`]+/gi) || [];
    const cleaned = matches
      .map((match) => match.replace(/[)\],.;!?]+$/g, ''))
      .filter(Boolean);

    return Array.from(new Set(cleaned));
  }

  private extractEmails(text: string): string[] {
    if (!text) return [];

    const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return Array.from(new Set(matches.map((match) => match.toLowerCase())));
  }
}
