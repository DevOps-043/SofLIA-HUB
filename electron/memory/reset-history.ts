type DatabaseLike = {
  prepare: (sql: string) => {
    run: (...args: any[]) => unknown;
    get: (...args: any[]) => any;
    all: (...args: any[]) => any[];
  };
};

export function clearSessionResetMarker(db: DatabaseLike | null, sessionKey: string): void {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO messages (session_key, phone_number, group_jid, role, content, timestamp)
      VALUES (?, '', NULL, 'user', '__RESET__', ?)
    `).run(sessionKey, Date.now());
  } catch (err: any) {
    console.error('[MemoryService] clearSessionContext error:', err.message);
  }
}

export function getHistorySinceReset(
  db: DatabaseLike | null,
  sessionKey: string,
  limit: number,
): Array<{ role: string; parts: Array<{ text: string }> }> {
  if (!db) return [];

  try {
    const resetRow = db.prepare(`
      SELECT timestamp FROM messages
      WHERE session_key = ? AND content = '__RESET__'
      ORDER BY timestamp DESC LIMIT 1
    `).get(sessionKey) as { timestamp: number } | undefined;
    const sinceTs = resetRow?.timestamp || 0;
    const messages = db.prepare(`
      SELECT role, content, timestamp FROM messages
      WHERE session_key = ? AND timestamp > ? AND content != '__RESET__'
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(sessionKey, sinceTs, limit) as Array<{ role: string; content: string; timestamp: number }>;

    const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    for (const msg of messages.reverse()) {
      const role = msg.role === 'user' ? 'user' : 'model';
      if (history.length > 0 && history[history.length - 1].role === role) {
        history[history.length - 1].parts.push({ text: msg.content });
      } else {
        history.push({ role, parts: [{ text: msg.content }] });
      }
    }

    while (history.length > 0 && history[0].role === 'model') history.shift();
    while (history.length > 0 && history[history.length - 1].role === 'user') history.pop();
    return history;
  } catch (err: any) {
    console.error('[MemoryService] getConversationHistorySinceReset error:', err.message);
    return [];
  }
}
