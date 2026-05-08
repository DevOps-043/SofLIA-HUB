import type { GmailService } from '../gmail-service';

export async function appendBulkLabelVerificationResponse(params: {
  bulkLabelsToVerify: Set<string> | null | undefined;
  gmailService: GmailService | null;
  functionResponses: any[];
}): Promise<void> {
  if (!params.bulkLabelsToVerify?.size || !params.gmailService) return;

  try {
    const remainingWarnings: string[] = [];
    for (const labelId of params.bulkLabelsToVerify) {
      const check = await params.gmailService.getMessages({ labelIds: [labelId], maxResults: 5 });
      if (check.success && check.messages && check.messages.length > 0) {
        remainingWarnings.push(`"${labelId}" aun tiene ${check.messages.length}+ correos`);
      }
    }
    if (remainingWarnings.length === 0) return;

    const verificationMsg = `VERIFICACION AUTOMATICA: Las siguientes etiquetas AUN tienen correos sin procesar: ${remainingWarnings.join(', ')}. DEBES continuar procesando estos correos - llama gmail_get_messages para cada etiqueta pendiente y repite el proceso hasta que todas esten vacias. NO respondas al usuario hasta completar TODO.`;
    console.log(`[WhatsApp Agent] Bulk verification: ${remainingWarnings.join(', ')}`);
    params.functionResponses.push({
      functionResponse: {
        name: 'gmail_modify_labels',
        response: { verification_result: verificationMsg, labels_with_remaining: remainingWarnings },
      },
    });
  } catch (verifyErr: any) {
    console.warn('[WhatsApp Agent] Bulk verification failed:', verifyErr.message);
  }
}
