type GeminiTextHistory = Array<{ role: string; parts: Array<{ text: string }> }>;

const RETRY_PATTERN = /\b(vuelve a|otra vez|hazlo de nuevo|no (hiciste|completaste|hizo)|intenta de nuevo|intentar|no funciono|no funciono|repite|reintenta|rehacer|rehaz|no computaste|nada de lo que|no (hice|hizo) nada)\b/i;

export function prepareWhatsAppConversationHistory(params: {
  conversations: Map<string, GeminiTextHistory>;
  sessionKey: string;
  userMessage: string;
  loadPersistedHistory: () => GeminiTextHistory;
}): GeminiTextHistory {
  const { conversations, sessionKey, userMessage, loadPersistedHistory } = params;

  if (!conversations.has(sessionKey)) {
    const persisted = loadPersistedHistory();
    conversations.set(sessionKey, persisted.length > 0 ? persisted : []);
    if (persisted.length > 0) {
      console.log(`[WhatsApp Agent] Restored ${persisted.length} history entries from SQLite for ${sessionKey}`);
    }
  }

  if (RETRY_PATTERN.test(userMessage)) {
    console.log(`[WhatsApp Agent] Retry request detected - resetting chat history for ${sessionKey} to avoid stale context`);
    conversations.set(sessionKey, []);
  }

  const history = conversations.get(sessionKey)!;
  const cleanHistory: GeminiTextHistory = [];
  for (const entry of history) {
    const textParts = entry.parts.filter((part) => typeof part.text === 'string' && part.text.trim());
    if (textParts.length === 0) continue;
    if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === entry.role) {
      cleanHistory[cleanHistory.length - 1].parts.push(...textParts);
    } else {
      cleanHistory.push({ role: entry.role, parts: textParts.map((part) => ({ text: part.text })) });
    }
  }

  while (cleanHistory.length > 0 && cleanHistory[0].role === 'model') {
    cleanHistory.shift();
  }
  while (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
    cleanHistory.pop();
  }

  return cleanHistory.map((entry) => ({ role: entry.role, parts: [...entry.parts] }));
}
