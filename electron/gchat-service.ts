/**
 * GChatService - Google Chat API integration.
 * Public facade kept stable while implementation lives in electron/gchat/.
 */
import { EventEmitter } from 'node:events';
import type { CalendarService } from './calendar-service';
import type { ChatSpace } from './gchat/types';
import { listSpaces } from './gchat/list-spaces';
import { getMessages } from './gchat/get-messages';
import { sendMessage } from './gchat/send-message';
import { addReaction } from './gchat/add-reaction';
import { getMembers } from './gchat/get-members';
import { listSpacesInternal } from './gchat/list-spaces-internal';
import { mapSpace } from './gchat/map-space';
import { resolveSpaceDisplayName } from './gchat/resolve-space-display-name';
import { sortSpaces } from './gchat/sort-spaces';
import { compareDateStringsDesc } from './gchat/compare-date-strings-desc';
import { resolveSpaceReference } from './gchat/resolve-space-reference';
import { normalizeUserAlias } from './gchat/normalize-user-alias';
import { extractSpaceNameFromUrl } from './gchat/extract-space-name-from-url';
import { findDirectMessageByUserAlias } from './gchat/find-direct-message-by-user-alias';
import { getCachedResolvedReference } from './gchat/get-cached-resolved-reference';
import { rememberResolvedReference } from './gchat/remember-resolved-reference';
import { findSpaceByDisplayName } from './gchat/find-space-by-display-name';
import { findSpaceByParticipantHint } from './gchat/find-space-by-participant-hint';
import { findSpaceByMentionedEmail } from './gchat/find-space-by-mentioned-email';
import { getConnectedGoogleEmail } from './gchat/get-connected-google-email';
import { isDirectMessageSpace } from './gchat/is-direct-message-space';
import { isHumanDirectMessageSpace } from './gchat/is-human-direct-message-space';
import { scoreSpaceMembers } from './gchat/score-space-members';
import { listRecentRawMessages } from './gchat/list-recent-raw-messages';
import { detectSelfUserIdentifiers } from './gchat/detect-self-user-identifiers';
import { scoreMessageHintMatch } from './gchat/score-message-hint-match';
import { escapeRegExp } from './gchat/escape-reg-exp';
import { normalizeSearchText } from './gchat/normalize-search-text';
import { resolveSenderDisplayName } from './gchat/resolve-sender-display-name';
import { extractMessageText } from './gchat/extract-message-text';
import { extractUrls } from './gchat/extract-urls';
import { extractEmails } from './gchat/extract-emails';

export type { ChatMessage, ChatSpace } from './gchat/types';

export class GChatService extends EventEmitter {
  calendarService: CalendarService;
  resolvedSpaceCache = new Map<string, ChatSpace>();
  selfUserIdentifiers = new Set<string>();
  selfUserDetectionDone = false;

  constructor(calendarService: CalendarService) {
    super();
    this.calendarService = calendarService;
  }

  listSpaces = listSpaces;
  getMessages = getMessages;
  sendMessage = sendMessage;
  addReaction = addReaction;
  getMembers = getMembers;
  listSpacesInternal = listSpacesInternal;
  mapSpace = mapSpace;
  resolveSpaceDisplayName = resolveSpaceDisplayName;
  sortSpaces = sortSpaces;
  compareDateStringsDesc = compareDateStringsDesc;
  resolveSpaceReference = resolveSpaceReference;
  normalizeUserAlias = normalizeUserAlias;
  extractSpaceNameFromUrl = extractSpaceNameFromUrl;
  findDirectMessageByUserAlias = findDirectMessageByUserAlias;
  getCachedResolvedReference = getCachedResolvedReference;
  rememberResolvedReference = rememberResolvedReference;
  findSpaceByDisplayName = findSpaceByDisplayName;
  findSpaceByParticipantHint = findSpaceByParticipantHint;
  findSpaceByMentionedEmail = findSpaceByMentionedEmail;
  getConnectedGoogleEmail = getConnectedGoogleEmail;
  isDirectMessageSpace = isDirectMessageSpace;
  isHumanDirectMessageSpace = isHumanDirectMessageSpace;
  scoreSpaceMembers = scoreSpaceMembers;
  listRecentRawMessages = listRecentRawMessages;
  detectSelfUserIdentifiers = detectSelfUserIdentifiers;
  scoreMessageHintMatch = scoreMessageHintMatch;
  escapeRegExp = escapeRegExp;
  normalizeSearchText = normalizeSearchText;
  resolveSenderDisplayName = resolveSenderDisplayName;
  extractMessageText = extractMessageText;
  extractUrls = extractUrls;
  extractEmails = extractEmails;
}
