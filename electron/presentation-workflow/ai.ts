import type { WhatsAppAgent } from '../whatsapp-agent';
import type { PresentacionData } from './types';

export async function extractPresentationData(agent: WhatsAppAgent, text: string): Promise<PresentacionData> {
  try {
    const model = agent.getGenAI().getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: { responseMimeType: 'application/json' },
    });
    const prompt = `Extrae correo electronico y nombre de empresa. Responde solo JSON: { "company": "Nombre", "email": "correo@ejemplo.com" }. Texto: "${text}"`;
    const parsed = JSON.parse((await model.generateContent(prompt)).response.text());
    return {
      clientCompanyName: parsed.company || undefined,
      clientEmail: parsed.email || undefined,
    };
  } catch (err) {
    console.error('[Workflow] Error extracting data:', err);
    return {};
  }
}

export async function generateProposalContent(agent: WhatsAppAgent, clientCompanyName: string): Promise<string> {
  const model = agent.getGenAI().getGenerativeModel({ model: 'gemini-2.5-pro'});
  const internalKnowledge = 'Pulse Hub desarrolla SofLIA, un ecosistema de IA empresarial con automatizacion, agentes IA y consultoria en transformacion digital.';
  const externalPrompt = `Resume brevemente que hace la empresa "${clientCompanyName}" y que necesidades tecnologicas puede tener.`;
  const externalKnowledge = (await model.generateContent(externalPrompt)).response.text();
  const proposalPrompt = `Actua como estratega de negocios.
Nuestra empresa: ${internalKnowledge}
Empresa Cliente: ${externalKnowledge} (Nombre: ${clientCompanyName})

Crea un resumen ejecutivo muy breve, maximo 3 puntos clave, de la propuesta de valor.`;
  return (await model.generateContent(proposalPrompt)).response.text();
}

export async function generateGammaMarkdown(agent: WhatsAppAgent, proposalContent: string): Promise<string> {
  const model = agent.getGenAI().getGenerativeModel({ model: 'gemini-2.5-pro'});
  const prompt = `Convierte este resumen ejecutivo en una presentacion formal de 3 diapositivas:
Resumen: ${proposalContent}

Genera texto en markdown con titulos y bullet points viables para Gamma App.`;
  return (await model.generateContent(prompt)).response.text();
}
