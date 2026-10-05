import type { WhatsAppAgent } from '../whatsapp-agent';
import { WA_MODEL } from '../wa-agent/constants';
import type { PresentacionData } from './types';

export async function extractPresentationData(agent: WhatsAppAgent, text: string): Promise<PresentacionData> {
  try {
    const client = await agent.getOpenAIClient();
    const prompt = `Extrae correo electronico y nombre de empresa. Responde solo JSON: { "company": "Nombre", "email": "correo@ejemplo.com" }. Texto: "${text}"`;
    const response = await client.responses.create({ model: WA_MODEL, input: prompt, store: false,
      reasoning: { effort: 'none' }, text: { format: { type: 'json_object' } }, max_output_tokens: 1024,
    });
    if (response.status !== 'completed') return {};
    const parsed = JSON.parse(response.output_text);
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
  const client = await agent.getOpenAIClient();
  const generate = async (prompt: string) => {
    const response = await client.responses.create({ model: WA_MODEL, input: prompt, store: false,
      reasoning: { effort: 'medium' }, max_output_tokens: 4096 });
    if (response.status !== 'completed' || !response.output_text.trim()) throw new Error('OpenAI no completó la propuesta.');
    return response.output_text;
  };
  const internalKnowledge = 'Pulse Hub desarrolla SofLIA, un ecosistema de IA empresarial con automatizacion, agentes IA y consultoria en transformacion digital.';
  const externalPrompt = `Resume brevemente que hace la empresa "${clientCompanyName}" y que necesidades tecnologicas puede tener.`;
  const externalKnowledge = await generate(externalPrompt);
  const proposalPrompt = `Actua como estratega de negocios.
Nuestra empresa: ${internalKnowledge}
Empresa Cliente: ${externalKnowledge} (Nombre: ${clientCompanyName})

Crea un resumen ejecutivo muy breve, maximo 3 puntos clave, de la propuesta de valor.`;
  return generate(proposalPrompt);
}
