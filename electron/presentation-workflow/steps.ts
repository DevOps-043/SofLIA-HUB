import type { WhatsAppAgent } from '../whatsapp-agent';
import type { WhatsAppService } from '../whatsapp-service';
import type { SkillWorkspaceService } from '../skill-workspace/service';
import type { PresentacionData } from './types';
import { generateProposalContent } from './ai';
import { generatePresentationForWhatsApp } from './html-generator';

export async function requestProposal(agent: WhatsAppAgent, companyName: string, email: string) {
  const proposalContent = await generateProposalContent(agent, companyName);
  return {
    proposalContent,
    approvalMessage: `Resumen Ejecutivo Propuesto para ${companyName}:\n\n${proposalContent}\n\nLe doy visto bueno para generar la presentacion final y enviarla a ${email}? (Responde "si" o "cancelar")`,
  };
}

/**
 * Genera la presentacion con el motor propio de HTML y entrega el PDF por el
 * mismo canal. Sustituye a la generacion via Gamma: el contenido del usuario
 * ya no sale hacia un tercero y el resultado es un archivo suyo.
 *
 * La entrega ocurre despues de la aprobacion explicita del usuario en el paso
 * AWAITING_APPROVAL del flujo.
 */
export async function completePresentation(
  agent: WhatsAppAgent,
  workspaceService: SkillWorkspaceService,
  waService: WhatsAppService,
  jid: string,
  data: PresentacionData,
  sendProgress: (message: string) => Promise<void>,
): Promise<string> {
  const titulo = `Propuesta para ${data.clientCompanyName ?? 'el cliente'}`;

  const result = await generatePresentationForWhatsApp({
    agent,
    workspaceService,
    title: titulo,
    contenido: data.proposalContent || '',
    onProgress: sendProgress,
  });

  if (!result.ok) {
    return `No pude completar la presentacion: ${result.error}`;
  }

  // Se envia el HTML, no un PDF: al abrirlo conserva transiciones y
  // animaciones. Se avisa de como abrirlo porque un .html en el telefono no
  // es tan obvio como un PDF.
  await waService.sendFile(jid, result.data.htmlPath, `${titulo} (presentacion generada por SofLIA)`);

  return [
    'Flujo completado.',
    '',
    `Presentacion generada para *${data.clientCompanyName}* y enviada en este chat.`,
    'Es un archivo HTML: abrelo con tu navegador para verla con sus transiciones.',
    result.data.brandingNotice ?? '',
    `Correo preparado para: ${data.clientEmail}`,
  ].filter(Boolean).join('\n');
}
