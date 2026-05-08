import { getWhatsAppSession } from '../../iris-data-main';

export function resolveCreatorUserId(ownerUserId: string): string | null {
  const session = getWhatsAppSession(ownerUserId);
  if (session?.userId) return session.userId;
  return ownerUserId || null;
}
