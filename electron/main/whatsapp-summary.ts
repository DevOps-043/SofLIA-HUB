type WhatsAppSummarySender = {
  getStatus(): { connected?: boolean };
  sendText(jid: string, text: string): Promise<unknown>;
};

export async function sendSummaryWhatsApp(
  waService: WhatsAppSummarySender,
  phoneNumber: string,
  summaryText: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!waService.getStatus().connected) {
      return { success: false, error: 'WhatsApp no conectado' };
    }

    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const jid = `${cleanNumber}@s.whatsapp.net`;
    await waService.sendText(jid, summaryText);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
