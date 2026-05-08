import { useEffect } from "react";

export function useCloseActiveChatMenu(
  activeMenuChatId: string | null,
  setActiveMenuChatId: (chatId: string | null) => void,
) {
  useEffect(() => {
    if (!activeMenuChatId) return;
    const handleClickOutside = () => setActiveMenuChatId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeMenuChatId, setActiveMenuChatId]);
}
