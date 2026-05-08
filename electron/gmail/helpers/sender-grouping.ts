import { BRAND_LABELS, GENERIC_EMAIL_DOMAINS, SECOND_LEVEL_TLDS } from '../constants';
import {
  cleanSenderDisplayName,
  extractEmailAddress,
  normalizeGroupingKey,
  sanitizeLabelName,
  toTitleCase,
} from './string-utils';

const ROLE_LIKE_REGEX = /\b(google|workspace|alerts|billing|team|support|notifications?|docs|drive|calendar)\b/i;
const NOTIFICATION_REGEX = /\b(alerts|billing|team|support|notifications?)\b/i;
const PERSONAL_DOMAIN = 'google.com';

interface OrganizationLabel {
  groupKey: string;
  labelName: string;
  domain?: string;
}

export interface MessageGrouping {
  groupKey: string;
  labelName: string;
  domain?: string;
  senderSample: string;
}

export function getBaseDomain(domain: string): string {
  const cleanDomain = domain.toLowerCase().trim();
  const parts = cleanDomain.split('.').filter(Boolean);
  if (parts.length <= 2) return cleanDomain;

  const lastTwo = parts.slice(-2).join('.');
  if (SECOND_LEVEL_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

function inferOrganizationLabel(displayName: string, baseDomain: string): OrganizationLabel {
  const cleanedDisplay = cleanSenderDisplayName(displayName, '');
  const lowerDisplay = cleanedDisplay.toLowerCase();
  const brandKey = baseDomain.split('.')[0] || baseDomain;
  const brandLabel =
    BRAND_LABELS.get(baseDomain) || BRAND_LABELS.get(brandKey) || toTitleCase(brandKey);
  const looksPersonLike =
    cleanedDisplay.split(/\s+/).length >= 2 && !ROLE_LIKE_REGEX.test(lowerDisplay);

  if ((baseDomain === PERSONAL_DOMAIN || GENERIC_EMAIL_DOMAINS.has(baseDomain)) && looksPersonLike) {
    const personLabel = sanitizeLabelName(cleanedDisplay);
    return { groupKey: `person:${normalizeGroupingKey(personLabel)}`, labelName: personLabel };
  }

  if (cleanedDisplay && lowerDisplay.includes(brandLabel.toLowerCase())) {
    return { groupKey: `domain:${baseDomain}`, labelName: brandLabel, domain: baseDomain };
  }

  if (
    cleanedDisplay &&
    !GENERIC_EMAIL_DOMAINS.has(baseDomain) &&
    cleanedDisplay.length <= 32 &&
    !NOTIFICATION_REGEX.test(lowerDisplay)
  ) {
    return {
      groupKey: `domain:${baseDomain}`,
      labelName: sanitizeLabelName(cleanedDisplay),
      domain: baseDomain,
    };
  }

  return {
    groupKey: `domain:${baseDomain}`,
    labelName: sanitizeLabelName(brandLabel),
    domain: baseDomain,
  };
}

export function inferMessageGrouping(fromHeader: string): MessageGrouping {
  const email = extractEmailAddress(fromHeader);
  const displayName = cleanSenderDisplayName(fromHeader, email);
  const domain = email.includes('@') ? email.split('@')[1] : '';
  const baseDomain = domain ? getBaseDomain(domain) : '';

  if (baseDomain && !GENERIC_EMAIL_DOMAINS.has(baseDomain)) {
    return { ...inferOrganizationLabel(displayName, baseDomain), senderSample: displayName || email || fromHeader };
  }

  const fallbackLabel = sanitizeLabelName(displayName || email.split('@')[0] || 'Otros');
  return {
    groupKey: `person:${normalizeGroupingKey(fallbackLabel)}`,
    labelName: fallbackLabel,
    domain: baseDomain || undefined,
    senderSample: displayName || email || fromHeader,
  };
}
