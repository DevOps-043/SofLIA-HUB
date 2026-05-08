export function unwrapMessageContainers(msg: any): void {
  if (msg.message.viewOnceMessage?.message) {
    msg.message = { ...msg.message, ...msg.message.viewOnceMessage.message };
  }
  if (msg.message.ephemeralMessage?.message) {
    msg.message = { ...msg.message, ...msg.message.ephemeralMessage.message };
  }
  if (msg.message.documentWithCaptionMessage?.message) {
    msg.message = { ...msg.message, ...msg.message.documentWithCaptionMessage.message };
  }
}

export async function resolveSenderNumber(sock: any, msg: any, jid: string, isGroup: boolean): Promise<string> {
  if (isGroup) {
    return (msg.key.participant || msg.key.remoteJid || '')
      .toString()
      .replace('@s.whatsapp.net', '')
      .replace(/@lid$/, '')
      .split(':')[0];
  }
  if (!jid.endsWith('@lid')) return jid.replace('@s.whatsapp.net', '');

  try {
    const phone = await sock?.signalRepository?.lidMapping?.getPNForLID(jid);
    if (phone) return phone.split(':')[0].replace('@s.whatsapp.net', '').replace('@lid', '');
    return jid.replace('@lid', '');
  } catch (err) {
    console.warn(`[WhatsApp] Error resolving LID ${jid}:`, err);
    return jid.replace('@lid', '');
  }
}

export function extractRawText(msg: any): string {
  return msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.documentMessage?.caption ||
    msg.message.videoMessage?.caption ||
    '';
}

export function cleanGroupText(rawText: string, prefix: string, botNumber: string): string {
  let cleanText = rawText.trim();
  if (cleanText.toLowerCase().startsWith(prefix.toLowerCase())) {
    cleanText = cleanText.slice(prefix.length).trim();
  }
  return botNumber ? cleanText.replace(new RegExp(`@${botNumber}\\s*`, 'g'), '').trim() : cleanText;
}
