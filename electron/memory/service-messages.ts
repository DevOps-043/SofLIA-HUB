import { RECENT_MESSAGES_LIMIT } from './constants';
import { phoneOwnerKey } from './scope';
import type { MemoryMessageApi, MemoryServiceConstructor } from './service-types';
import type { StoredMessage } from './types';

export function attachMemoryMessages(Service: MemoryServiceConstructor): void {
  Object.assign(Service.prototype, {
    saveMessage(params) {
      if (!this.db || !params.content.trim()) return;
      try {
        // ownerKey unifica el scope entre superficies; si no llega se deriva del
        // telefono (WhatsApp) para no cambiar el comportamiento existente.
        const ownerKey = params.ownerKey || phoneOwnerKey(params.phoneNumber);
        this.db.prepare(`
          INSERT INTO messages (session_key, phone_number, owner_key, group_jid, role, content, media_type, media_filename, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(params.sessionKey, params.phoneNumber, ownerKey, params.groupJid || null, params.role, params.content, params.mediaType || null, params.mediaFilename || null, Date.now());
        this.checkSummarizationThreshold(params.sessionKey);
      } catch (err: any) {
        console.error('[MemoryService] saveMessage error:', err.message);
      }
    },
    getRecentMessages(sessionKey: string, limit = RECENT_MESSAGES_LIMIT) {
      if (!this.db) return [];
      try {
        const rows = this.db.prepare(`
          SELECT * FROM messages WHERE session_key = ? ORDER BY timestamp DESC LIMIT ?
        `).all(sessionKey, limit) as StoredMessage[];
        return rows.reverse();
      } catch (err: any) {
        console.error('[MemoryService] getRecentMessages error:', err.message);
        return [];
      }
    },
    getConversationHistory(sessionKey: string, limit = RECENT_MESSAGES_LIMIT) {
      const history: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      for (const msg of this.getRecentMessages(sessionKey, limit)) {
        const role = msg.role === 'user' ? 'user' : 'model';
        const lastEntry = history[history.length - 1];
        if (lastEntry?.role === role) lastEntry.parts.push({ text: msg.content });
        else history.push({ role, parts: [{ text: msg.content }] });
      }
      while (history.length > 0 && history[0].role === 'model') history.shift();
      while (history.length > 0 && history[history.length - 1]?.role === 'user') history.pop();
      return history;
    },
  } satisfies MemoryMessageApi & ThisType<any>);
}
