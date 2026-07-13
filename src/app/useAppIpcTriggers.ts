import { useEffect, useState } from "react";
import type { BrowserMeetingTriggerPayload } from "../services/meeting-auto-session-store";

interface UseAppIpcTriggersArgs {
  isOrbWindow: boolean;
}

export function useAppIpcTriggers({ isOrbWindow }: UseAppIpcTriggersArgs) {
  const [pendingShareLink, setPendingShareLink] = useState<string | null>(null);
  const [pendingMeetingTrigger, setPendingMeetingTrigger] =
    useState<BrowserMeetingTriggerPayload | null>(null);

  useEffect(() => {
    // La ventana orbe no participa de share links ni triggers de reuniones.
    if (isOrbWindow) return;
    const ipc = (window as any).ipcRenderer;
    if (!ipc) return;

    const handleShareLink = (_event: any, shareLink: string) => setPendingShareLink(shareLink);
    const handleMeetingTrigger = (_event: any, payload: BrowserMeetingTriggerPayload) => {
      setPendingMeetingTrigger(payload);
    };

    ipc.on("app:share-link", handleShareLink);
    ipc.on("app:meeting-trigger", handleMeetingTrigger);

    void ipc.invoke("app:get-pending-share-link")
      .then((shareLink: string | null) => {
        if (shareLink) setPendingShareLink(shareLink);
      })
      .catch((error: unknown) => {
        console.warn("[App] No pude recuperar el share link pendiente:", error);
      });

    void ipc.invoke("app:get-pending-meeting-trigger")
      .then((payload: BrowserMeetingTriggerPayload | null) => {
        if (payload) setPendingMeetingTrigger(payload);
      })
      .catch((error: unknown) => {
        console.warn("[App] No pude recuperar el trigger de reunion pendiente:", error);
      });

    return () => {
      ipc.off?.("app:share-link", handleShareLink);
      ipc.off?.("app:meeting-trigger", handleMeetingTrigger);
    };
  }, [isOrbWindow]);

  return {
    pendingShareLink,
    setPendingShareLink,
    pendingMeetingTrigger,
    setPendingMeetingTrigger,
  };
}
