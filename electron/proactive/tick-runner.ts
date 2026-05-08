import { composeProactiveMessage } from './ai-message';
import { collectProactiveData } from './data-collector';
import type { ProactiveRuntimeContext } from './types';

export async function runProactiveTick(context: ProactiveRuntimeContext): Promise<void> {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    resetDailyTracking(context, now.toISOString().split('T')[0]);
    if (!context.config.notificationHours.includes(currentHour)) return;

    const { getAllWhatsAppSessions } = await import('../iris-data-main');
    const sessions = getAllWhatsAppSessions();
    if (!sessions?.length || !context.waService?.isConnected()) return;

    for (const session of sessions) {
      await notifySessionIfNeeded(context, session, currentHour);
    }
  } catch (error) {
    console.error('[ProactiveService] Tick error:', error);
  }
}

function resetDailyTracking(context: ProactiveRuntimeContext, todayStr: string): void {
  if (todayStr === context.getLastNotifiedDate()) return;
  context.setLastNotifiedDate(todayStr);
  context.lastNotifiedHours.clear();
}

async function notifySessionIfNeeded(
  context: ProactiveRuntimeContext,
  session: any,
  currentHour: number,
): Promise<void> {
  const phoneNumber = session.phoneNumber;
  if (!context.lastNotifiedHours.has(phoneNumber)) {
    context.lastNotifiedHours.set(phoneNumber, new Set());
  }
  const notifiedHours = context.lastNotifiedHours.get(phoneNumber)!;
  if (notifiedHours.has(currentHour)) return;

  console.log(`[ProactiveService] Sending notification to ${session.fullName} (${phoneNumber}) at hour ${currentHour}`);
  try {
    const payload = await collectProactiveData(context, session);
    if (payload.calendarEvents.length > 0 || payload.urgentTasks.length > 0 || payload.systemAlerts.length > 0) {
      const message = await composeProactiveMessage(context.apiKey, payload);
      if (message) {
        await context.waService.sendText(`${phoneNumber}@s.whatsapp.net`, message);
        console.log(`[ProactiveService] ✅ Notification sent to ${session.fullName}`);
        context.emit('notification-sent', { phoneNumber, userName: session.fullName, hour: currentHour });
      }
    } else {
      console.log(`[ProactiveService] No pending items for ${session.fullName} — skipping.`);
    }
    notifiedHours.add(currentHour);
  } catch (error) {
    console.error(`[ProactiveService] Error sending notification to ${phoneNumber}:`, error);
  }
}
