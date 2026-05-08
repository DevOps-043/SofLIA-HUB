import { useEffect, useState } from "react";
import type { BrowserMeetingTriggerPayload } from "../services/meeting-auto-session-store";

interface UseAppIpcTriggersArgs {
  isFlowWindow: boolean;
  onExternalPrompt: (text: string) => void;
}

export function useAppIpcTriggers({ isFlowWindow, onExternalPrompt }: UseAppIpcTriggersArgs) {
  const [flowKey, setFlowKey] = useState(0);
  const [pendingShareLink, setPendingShareLink] = useState<string | null>(null);
  const [pendingMeetingTrigger, setPendingMeetingTrigger] =
    useState<BrowserMeetingTriggerPayload | null>(null);

  useEffect(() => {
    const ipc = (window as any).ipcRenderer;
    if (!ipc) return;

    const handleFlowMessage = (_event: any, text: string) => onExternalPrompt(text);
    const handleShareLink = (_event: any, shareLink: string) => setPendingShareLink(shareLink);
    const handleMeetingTrigger = (_event: any, payload: BrowserMeetingTriggerPayload) => {
      setPendingMeetingTrigger(payload);
    };
    const handleFlowWindowShown = () => setFlowKey((prev) => prev + 1);

    ipc.on("flow-message-received", handleFlowMessage);
    ipc.on("app:share-link", handleShareLink);
    ipc.on("app:meeting-trigger", handleMeetingTrigger);
    if (isFlowWindow) ipc.on("flow-window-shown", handleFlowWindowShown);

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
      ipc.off?.("flow-message-received", handleFlowMessage);
      ipc.off?.("app:share-link", handleShareLink);
      ipc.off?.("app:meeting-trigger", handleMeetingTrigger);
      ipc.off?.("flow-window-shown", handleFlowWindowShown);
    };
  }, [isFlowWindow, onExternalPrompt]);

  return {
    flowKey,
    pendingShareLink,
    setPendingShareLink,
    pendingMeetingTrigger,
    setPendingMeetingTrigger,
  };
}
