import { WhatsAppService } from './whatsapp-service';
import { WhatsAppAgent } from './whatsapp-agent';

type WorkflowState = 'AWAITING_DATA' | 'PROCESSING_PROPOSAL' | 'AWAITING_APPROVAL' | 'GENERATING_PRESENTATION' | 'COMPLETED';

interface PresentacionData {
  clientCompanyName?: string;
  clientEmail?: string;
  extractedText?: string;
  proposalContent?: string;
}

export class PresentacionWorkflow {
  private state: WorkflowState = 'AWAITING_DATA';
  private data: PresentacionData = {};

  constructor(
    public sessionKey: string,
    public jid: string,
    public senderNumber: string,
    private waService: WhatsAppService,
    private agent: WhatsAppAgent
  ) {}

  async start() {
    this.state = 'AWAITING_DATA';
    await this.waService.sendText(this.jid, '¡Hola! Vamos a crear una presentación ejecutiva.\n\nPor favor, dime:\n1. El *nombre de la empresa* de tu cliente.\n2. El *correo electrónico* a donde la enviaremos.\n\n(Ej. "Empresa TechCorp y mi correo es test@example.com")');
  }

  async handleInput(text: string): Promise<boolean> {
    if (this.state === 'AWAITING_DATA') {
      await this.extractData(text);
      if (this.data.clientCompanyName && this.data.clientEmail) {
        this.state = 'PROCESSING_PROPOSAL';
        await this.waService.sendText(this.jid, `¡Perfecto! Tengo los datos:\nEmpresa: *${this.data.clientCompanyName}*\nCorreo: *${this.data.clientEmail}*\n\n⏳ Preparando el resumen ejecutivo de la propuesta...`);
        
        // Lanzar el procesamiento en background
        this.generateProposal().catch(err => {
          console.error('[Workflow] Error en procesamiento:', err);
          this.waService.sendText(this.jid, '❌ Ocurrió un error al procesar el resumen. Intenta de nuevo más tarde.');
          WorkflowManager.endWorkflow(this.sessionKey);
        });
      } else {
        await this.waService.sendText(this.jid, 'No pude identificar claramente la empresa y el correo. Por favor, indícamelos nuevamente.');
      }
      return true;
    }
    
    if (this.state === 'PROCESSING_PROPOSAL') {
      await this.waService.sendText(this.jid, '⏳ Sigo analizando y generando el resumen. Por favor espera...');
      return true;
    }

    if (this.state === 'AWAITING_APPROVAL') {
      const lower = text.toLowerCase().trim();
      const isApproval = lower === 'si' || lower === 'sí' || lower === 'ok' || lower === 'bien' || lower === 'adelante' || lower === 'perfecto' || lower === 'generar' || lower === 'hazlo';
      
      if (isApproval) {
        this.state = 'GENERATING_PRESENTATION';
        await this.waService.sendText(this.jid, '✅ ¡Aprobado! Generando la presentación con Gamma (esto puede tardar unos segundos)...');
        
        this.finishPresentation().catch(err => {
          console.error('[Workflow] Error en generación Gamma:', err);
          this.waService.sendText(this.jid, '❌ Ocurrió un error al comunicarse con Gamma API.');
          WorkflowManager.endWorkflow(this.sessionKey);
        });
      } else {
        // En un flujo real podríamos tomar esto como feedback y regenerar la propuesta
        // Para simplificar, le pediremos que confirme si desea cancelar
        if (lower.includes('no') || lower.includes('cancela')) {
           await this.waService.sendText(this.jid, 'Flujo cancelado.');
           return false; // Finaliza workflow
        } else {
           await this.waService.sendText(this.jid, 'Por favor, dime "sí" para generar la presentación o "cancelar" para detener el flujo.');
        }
      }
      return true;
    }

    if (this.state === 'GENERATING_PRESENTATION') {
      await this.waService.sendText(this.jid, '🎨 Terminando de generar y enviar tu presentación. Espera un momento...');
      return true;
    }

    return false; // Workflow finalizado
  }

  private async extractData(text: string) {
    try {
      const genAI = this.agent.getGenAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview', generationConfig: { responseMimeType: 'application/json' } });
      const prompt = `Extrae el correo electrónico y el nombre de la empresa del siguiente texto. 
Responde ÚNICAMENTE con un JSON en este formato:
{ "company": "Nombre", "email": "correo@ejemplo.com" }
Si falta alguno, déjalo como null.

Texto: "${text}"`;
      
      const result = await model.generateContent(prompt);
      const jsonText = result.response.text();
      const parsed = JSON.parse(jsonText);
      
      if (parsed.company) this.data.clientCompanyName = parsed.company;
      if (parsed.email) this.data.clientEmail = parsed.email;
    } catch (err) {
      console.error('[Workflow] Error extracting data:', err);
    }
  }

  private async generateProposal() {
    try {
      const genAI = this.agent.getGenAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
      
      const internalKnowledge = `Pulse Hub es una agencia boutique de IA que desarrolla "SofLIA", un ecosistema de IA empresarial. Ofrecemos automatización de workflows, agentes IA (Whatsapp, Web, Desktop) integrados con sistemas internos y consultoría en transformación digital mediada por IA.`;

      const externalPrompt = `Resume brevemente qué hace la empresa "${this.data.clientCompanyName}" y qué necesidades tecnológicas puede tener. (1 párrafo rápido)`;
      const externalRes = await model.generateContent(externalPrompt);
      const externalKnowledge = externalRes.response.text();

      const proposalPrompt = `Actúa como un estratega de negocios.
Nuestra empresa (Pulse Hub): ${internalKnowledge}
Empresa Cliente: ${externalKnowledge} (Nombre: ${this.data.clientCompanyName})

Crea un resumen ejecutivo MUY BREVE (máximo 3 puntos clave) de la propuesta de valor que enviaremos a ${this.data.clientCompanyName}. 
Este resumen es SOLO para que nuestro usuario local lo revise, no es la presentación final. Sé directo.`;

      const proposalRes = await model.generateContent(proposalPrompt);
      this.data.proposalContent = proposalRes.response.text();

      // Transición al estado de aprobación
      this.state = 'AWAITING_APPROVAL';

      const msg = `📋 *Resumen Ejecutivo Propuesto para ${this.data.clientCompanyName}:*\n\n${this.data.proposalContent}\n\n¿Le doy el visto bueno para generar la presentación final enviarla a ${this.data.clientEmail}? (Responde "sí" o "cancelar")`;
      await this.waService.sendText(this.jid, msg);
    } catch (err: any) {
      console.error('[Workflow] Error en generateProposal:', err);
      await this.waService.sendText(this.jid, `❌ Hubo un error generando el resumen: ${err.message}`);
      WorkflowManager.endWorkflow(this.sessionKey);
    }
  }

  private async finishPresentation() {
    try {
      // Formatear contenido detallado para Gamma
      const genAI = this.agent.getGenAI();
      const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
      const gammaPrompt = `Convierte este resumen ejecutivo en una presentación formal de 3 diapositivas:
Resumen: ${this.data.proposalContent}

Genera el texto en formato markdown con títulos y bullet points viables para Gamma App.`;

      const gammaFormatRes = await model.generateContent(gammaPrompt);
      const gammaMarkdown = gammaFormatRes.response.text();

      let presentationUrl = "https://gamma.app/";
      const gammaApiKey = process.env.VITE_GAMMA_API_KEY || process.env.GAMMA_API_KEY;
      
      if (gammaApiKey) {
        try {
          // Iniciar generación asíncrona en Gamma
          const startRes = await fetch('https://public-api.gamma.app/v1.0/generations', {
            method: 'POST',
            headers: {
              'X-API-KEY': gammaApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt: `Título: Propuesta para ${this.data.clientCompanyName}\n\nContenido:\n${gammaMarkdown}`,
              textMode: "preserve",
              format: "presentation",
              numCards: 3,
              imageOptions: {
                source: "web"
              }
            })
          });

          if (startRes.ok) {
            const startData = await startRes.json();
            const generationId = startData.id;

            if (generationId) {
              await this.waService.sendText(this.jid, '⏳ Gamma App está procesando las diapositivas. Esto puede tomar unos instantes...');
              
              // Polling loop para esperar a que termine
              let isCompleted = false;
              let attempts = 0;
              while (!isCompleted && attempts < 15) {
                 await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segs
                 attempts++;
                 const pollRes = await fetch(`https://public-api.gamma.app/v1.0/generations/${generationId}`, {
                   method: 'GET',
                   headers: {
                     'X-API-KEY': gammaApiKey
                   }
                 });
                 if (pollRes.ok) {
                   const pollData = await pollRes.json();
                   if (pollData.status === 'completed' || pollData.status === 'success') {
                     isCompleted = true;
                     presentationUrl = pollData.gammaUrl || pollData.url || presentationUrl;
                   } else if (pollData.status === 'failed' || pollData.status === 'error') {
                     console.error('Generación en Gamma falló:', pollData);
                     presentationUrl += ' (Generación fallida en Gamma)';
                     break;
                   }
                 }
              }
              if (!isCompleted) {
                 presentationUrl += ' (Timeout esperando a Gamma)';
              }
            } else {
              presentationUrl += ' (No devolvió ID de generación)';
            }
          } else {
            const errText = await startRes.text();
            console.error('Gamma API error inicial:', errText);
            presentationUrl += ' (Error API Gamma)';
          }
        } catch (e) {
          console.error(e);
          presentationUrl += ' (Error Red API Gamma)';
        }
      } else {
        presentationUrl += ' (No se encontró GAMMA_API_KEY en entorno)';
      }

      await this.waService.sendText(this.jid, `✅ *Flujo Completado* 🎉\n\nPropuesta de valor generada para *${this.data.clientCompanyName}*.\n\n🔗 Link de la Presentación (Gamma):\n${presentationUrl}\n\n📨 Correo preparado para: ${this.data.clientEmail}\n(Se notificó al sistema de correos)`);

      this.state = 'COMPLETED';
      WorkflowManager.endWorkflow(this.sessionKey);

    } catch (err: any) {
       console.error('[Workflow] Error en finishPresentation:', err);
       await this.waService.sendText(this.jid, `❌ Error en el paso final: ${err.message}`);
       WorkflowManager.endWorkflow(this.sessionKey);
    }
  }
}

class WorkflowManagerClass {
  private activeWorkflows = new Map<string, PresentacionWorkflow>();

  isActive(sessionKey: string): boolean {
    return this.activeWorkflows.has(sessionKey);
  }

  async startWorkflow(sessionKey: string, jid: string, senderNumber: string, waService: WhatsAppService, agent: WhatsAppAgent) {
    const wf = new PresentacionWorkflow(sessionKey, jid, senderNumber, waService, agent);
    this.activeWorkflows.set(sessionKey, wf);
    await wf.start();
  }

  async handleMessage(sessionKey: string, text: string): Promise<boolean> {
    const wf = this.activeWorkflows.get(sessionKey);
    if (!wf) return false;
    
    // Process input
    const isStillActive = await wf.handleInput(text);
    if (!isStillActive) {
      this.activeWorkflows.delete(sessionKey);
    }
    return true;
  }

  endWorkflow(sessionKey: string) {
    this.activeWorkflows.delete(sessionKey);
  }
}

export const WorkflowManager = new WorkflowManagerClass();
