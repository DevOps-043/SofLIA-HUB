import type { WhatsAppAgent } from '../whatsapp-agent';
import type { PresentacionData } from './types';
import { generateGammaMarkdown, generateProposalContent } from './ai';
import { generateGammaPresentationUrl } from './gamma';

export async function requestProposal(agent: WhatsAppAgent, companyName: string, email: string) {
  const proposalContent = await generateProposalContent(agent, companyName);
  return {
    proposalContent,
    approvalMessage: `Resumen Ejecutivo Propuesto para ${companyName}:\n\n${proposalContent}\n\nLe doy visto bueno para generar la presentacion final y enviarla a ${email}? (Responde "si" o "cancelar")`,
  };
}

export async function completePresentation(
  agent: WhatsAppAgent,
  data: PresentacionData,
  sendProgress: (message: string) => Promise<void>,
): Promise<string> {
  const gammaMarkdown = await generateGammaMarkdown(agent, data.proposalContent || '');
  const presentationUrl = await generateGammaPresentationUrl(data.clientCompanyName || '', gammaMarkdown, sendProgress);
  return `Flujo Completado\n\nPropuesta generada para *${data.clientCompanyName}*.\n\nLink de la Presentacion (Gamma):\n${presentationUrl}\n\nCorreo preparado para: ${data.clientEmail}`;
}
