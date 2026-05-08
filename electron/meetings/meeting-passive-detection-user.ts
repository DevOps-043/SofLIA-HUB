import type { CalendarService } from '../calendar-service';
import { getSofiaUserByEmail } from '../iris-data-main';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';

export async function resolvePassiveDetectionUser(
  calendarService: CalendarService,
): Promise<PassiveDetectionUserContext | null> {
  const googleConnection = calendarService
    .getConnections()
    .find((connection) => connection.provider === 'google' && connection.isActive && connection.email);

  if (!googleConnection?.email) return null;

  const sofiaUser = googleConnection.userId
    ? { id: googleConnection.userId, email: googleConnection.email, username: null, display_name: googleConnection.email }
    : await getSofiaUserByEmail(googleConnection.email);

  if (!sofiaUser?.id) {
    console.warn(`[MeetingPassiveDetection] Could not resolve SOFIA user for Google email ${googleConnection.email}. Auto-detection remains blocked until Google -> SOFIA mapping is fixed.`);
    return null;
  }

  return {
    ownerUserId: sofiaUser.id,
    email: googleConnection.email,
    displayName: sofiaUser.display_name || sofiaUser.username || googleConnection.email,
  };
}
