import { useEffect } from 'react';
import { handleAppMeetingTrigger } from '../services/app-meeting-trigger-service';
import type { BrowserMeetingTriggerPayload } from '../services/meeting-auto-session-store';

type ShareLinkNotice = { tone: 'info' | 'error'; message: string };

interface MeetingTriggerNoticeArgs {
  pendingMeetingTrigger: BrowserMeetingTriggerPayload | null;
  setPendingMeetingTrigger: (value: BrowserMeetingTriggerPayload | null) => void;
  setShareLinkNotice: (notice: ShareLinkNotice) => void;
  userId?: string;
}

export function useMeetingTriggerNotice({
  pendingMeetingTrigger,
  setPendingMeetingTrigger,
  setShareLinkNotice,
  userId,
}: MeetingTriggerNoticeArgs) {
  useEffect(() => {
    if (!pendingMeetingTrigger || !userId) return;
    void handleAppMeetingTrigger(userId, pendingMeetingTrigger)
      .then((result) => {
        setShareLinkNotice({
          tone: result.kind === 'error' ? 'error' : 'info',
          message: result.message,
        });
      })
      .catch((error) => {
        console.error('[App] Error procesando el trigger de reunion:', error);
        setShareLinkNotice({
          tone: 'error',
          message: 'No pude procesar el trigger de reunion enviado por la extension.',
        });
      })
      .finally(() => setPendingMeetingTrigger(null));
  }, [pendingMeetingTrigger, setPendingMeetingTrigger, setShareLinkNotice, userId]);
}
