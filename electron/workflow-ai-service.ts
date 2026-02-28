/**
 * Workflow AI Service — Meeting Entity Extraction & Artifact Generation
 *
 * Handles all AI generation for workflow artifacts using Google Gemini.
 * Follows the same GoogleGenerativeAI pattern as whatsapp-agent.ts.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────

export interface MeetingExtraction {
  company: {
    name: string;
    domain?: string;
    industry?: string;
    size_range?: string;
  };
  contact: {
    full_name: string;
    role_title?: string;
    email?: string;
    phone?: string;
  };
  pains: string[];
  objections: string[];
  intention: string;
  budget?: string;
  next_step: string;
  summary: string;
  confidence: Record<string, number>;
  missing_critical: string[];
}

export interface GeneratedArtifact {
  content: string;
  metadata: Record<string, any>;
  prompt_hash: string;
  model_used: string;
}

export interface QAResult {
  passed: boolean;
  issues: string[];
}

export interface ArtifactContext {
  extraction: MeetingExtraction;
  rawInput: string;
  companyName: string;
  contactName: string;
  opportunityTitle?: string;
  additionalContext?: string;
}

// ─── Models ──────────────────────────────────────────────────────────

const MODELS = {
  FAST: 'gemini-3-flash-preview',
  PRO: 'gemini-3-pro-preview',
  FALLBACK: 'gemini-2.5-flash',
};

// ─── Prompt Hash Helper ──────────────────────────────────────────────

function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

// ─── Workflow AI Service Class ───────────────────────────────────────

export class WorkflowAIService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    console.log('[WorkflowAI] Initialized');
  }

  // ─── Meeting Entity Extraction ───────────────────────────────────

  async extractMeetingEntities(rawInput: string, sourceType: string): Promise<{
    extraction: MeetingExtraction;
    promptHash: string;
    modelUsed: string;
  }> {
    const prompt = `Eres un asistente experto en extracción de datos de reuniones comerciales.

FUENTE: ${sourceType} (puede ser transcript de reunión, nota de voz, nota escrita, etc.)

ENTRADA:
${rawInput}

INSTRUCCIONES:
1. Extrae la información estructurada de la reunión/interacción comercial.
2. Para cada campo, evalúa un nivel de confianza (0.0 a 1.0).
3. Si un campo NO se menciona explícitamente, déjalo vacío y agrégalo a "missing_critical" si es importante.
4. NO inventes datos. Si no está en el texto, NO lo incluyas.
5. El resumen debe ser conciso (3-5 oraciones) y enfocarse en los hallazgos clave.

RESPONDE ESTRICTAMENTE en este formato JSON:
{
  "company": {
    "name": "nombre de la empresa del prospecto",
    "domain": "dominio web si se menciona",
    "industry": "industria/sector si se menciona",
    "size_range": "tamaño aprox. si se menciona (1-10, 11-50, 51-200, 201-500, 500+)"
  },
  "contact": {
    "full_name": "nombre completo del contacto",
    "role_title": "cargo/rol si se menciona",
    "email": "email si se menciona",
    "phone": "teléfono si se menciona"
  },
  "pains": ["dolor/necesidad 1", "dolor/necesidad 2"],
  "objections": ["objeción 1", "objeción 2"],
  "intention": "intención comercial detectada",
  "budget": "presupuesto mencionado (null si no se dice)",
  "next_step": "siguiente paso acordado",
  "summary": "resumen ejecutivo de la reunión (3-5 oraciones)",
  "confidence": {
    "company_name": 0.95,
    "contact_name": 0.90,
    "pains": 0.80,
    "next_step": 0.85
  },
  "missing_critical": ["campos críticos que faltan"]
}`;

    const promptH = hashPrompt(prompt);
    const model = this.genAI.getGenerativeModel({
      model: MODELS.FAST,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const extraction = JSON.parse(text) as MeetingExtraction;

      console.log(`[WorkflowAI] Extraction complete: company="${extraction.company.name}", contact="${extraction.contact.full_name}"`);
      return { extraction, promptHash: promptH, modelUsed: MODELS.FAST };
    } catch (err) {
      console.error('[WorkflowAI] extractMeetingEntities error:', err);
      // Fallback model
      try {
        const fallbackModel = this.genAI.getGenerativeModel({
          model: MODELS.FALLBACK,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        });
        const result = await fallbackModel.generateContent(prompt);
        const extraction = JSON.parse(result.response.text()) as MeetingExtraction;
        return { extraction, promptHash: promptH, modelUsed: MODELS.FALLBACK };
      } catch (fallbackErr) {
        console.error('[WorkflowAI] Fallback extraction also failed:', fallbackErr);
        throw fallbackErr;
      }
    }
  }

  // ─── Email Draft Generation ──────────────────────────────────────

  async generateEmailDraft(context: ArtifactContext): Promise<GeneratedArtifact> {
    const prompt = `Eres un asistente de ventas profesional. Genera un correo electrónico de seguimiento.

CONTEXTO DE LA REUNIÓN:
- Empresa: ${context.companyName}
- Contacto: ${context.contactName}
- Rol: ${context.extraction.contact.role_title || 'No especificado'}
- Necesidades: ${context.extraction.pains.join(', ') || 'No identificadas'}
- Objeciones: ${context.extraction.objections.join(', ') || 'Ninguna'}
- Siguiente paso: ${context.extraction.next_step}
- Resumen: ${context.extraction.summary}

REGLAS:
1. Tono profesional pero cercano.
2. Hacer referencia específica a lo discutido en la reunión.
3. Incluir un CTA (call-to-action) claro.
4. NO prometer nada que no se haya discutido.
5. Máximo 200 palabras.
6. Incluir asunto del correo.

FORMATO JSON:
{
  "subject": "Asunto del correo",
  "body": "Cuerpo del correo en texto plano",
  "cta": "Call-to-action principal"
}`;

    return this.generateArtifact(prompt, MODELS.FAST);
  }

  // ─── WhatsApp Message Generation ─────────────────────────────────

  async generateWhatsAppMessage(context: ArtifactContext): Promise<GeneratedArtifact> {
    const prompt = `Genera un mensaje corto de WhatsApp de seguimiento tras una reunión comercial.

CONTEXTO:
- Empresa: ${context.companyName}
- Contacto: ${context.contactName}
- Siguiente paso: ${context.extraction.next_step}
- Resumen: ${context.extraction.summary}

REGLAS:
1. Máximo 2-3 líneas.
2. Informal pero profesional.
3. Mencionar algo específico de la reunión.
4. Incluir el siguiente paso concreto.
5. NO usar emojis excesivos (máximo 1-2).

FORMATO JSON:
{
  "message": "El mensaje de WhatsApp"
}`;

    return this.generateArtifact(prompt, MODELS.FAST);
  }

  // ─── IRIS Tasks Generation ───────────────────────────────────────

  async generateIRISTasks(context: ArtifactContext): Promise<GeneratedArtifact> {
    const prompt = `Genera una lista de tareas internas (para el equipo) derivadas de una reunión comercial.

CONTEXTO:
- Empresa: ${context.companyName}
- Contacto: ${context.contactName}
- Necesidades: ${context.extraction.pains.join(', ') || 'No identificadas'}
- Siguiente paso: ${context.extraction.next_step}
- Resumen: ${context.extraction.summary}
${context.additionalContext ? `\nCONTEXTO ADICIONAL:\n${context.additionalContext}` : ''}

REGLAS:
1. Tareas accionables y específicas.
2. Cada tarea debe tener un responsable sugerido (ventas/marketing/delivery).
3. Incluir fecha sugerida (relativa: hoy, mañana, esta semana, próxima semana).
4. Prioridad: alta/media/baja.
5. Máximo 5 tareas.

FORMATO JSON:
{
  "tasks": [
    {
      "title": "Título de la tarea",
      "description": "Descripción detallada",
      "area": "ventas|marketing|delivery",
      "priority": "alta|media|baja",
      "due_relative": "hoy|mañana|esta_semana|proxima_semana"
    }
  ]
}`;

    return this.generateArtifact(prompt, MODELS.FAST);
  }

  // ─── Meeting Agenda Generation ───────────────────────────────────

  async generateMeetingAgenda(context: ArtifactContext): Promise<GeneratedArtifact> {
    const prompt = `Genera una propuesta de agenda para la siguiente reunión con un prospecto.

CONTEXTO DE REUNIÓN ANTERIOR:
- Empresa: ${context.companyName}
- Contacto: ${context.contactName} (${context.extraction.contact.role_title || 'rol no especificado'})
- Temas pendientes: ${context.extraction.pains.join(', ')}
- Objeciones no resueltas: ${context.extraction.objections.join(', ') || 'Ninguna'}
- Siguiente paso acordado: ${context.extraction.next_step}

REGLAS:
1. Agenda estructurada con tiempos sugeridos.
2. Incluir punto de revisión de acuerdos previos.
3. Incluir espacio para preguntas.
4. Duración total sugerida: 30-60 minutos.
5. Incluir objetivo de la reunión.

FORMATO JSON:
{
  "title": "Título de la reunión",
  "objective": "Objetivo principal",
  "duration_minutes": 45,
  "agenda_items": [
    {
      "order": 1,
      "topic": "Tema",
      "duration_minutes": 10,
      "description": "Detalle"
    }
  ],
  "attendees_suggested": ["Rol 1", "Rol 2"]
}`;

    return this.generateArtifact(prompt, MODELS.FAST);
  }

  // ─── Proposal Brief Generation ───────────────────────────────────

  async generateProposalBrief(context: ArtifactContext): Promise<GeneratedArtifact> {
    const prompt = `Genera un brief interno de propuesta/alcance (one-pager) basado en la reunión con un prospecto.

CONTEXTO:
- Empresa: ${context.companyName}
- Contacto: ${context.contactName} (${context.extraction.contact.role_title || 'rol no especificado'})
- Necesidades identificadas: ${context.extraction.pains.join(', ')}
- Objeciones: ${context.extraction.objections.join(', ') || 'Ninguna'}
- Intención: ${context.extraction.intention}
- Presupuesto: ${context.extraction.budget || 'No mencionado'}
- Resumen: ${context.extraction.summary}
${context.additionalContext ? `\nCONTEXTO ADICIONAL:\n${context.additionalContext}` : ''}

REGLAS:
1. Documento INTERNO (para el equipo, NO para el cliente).
2. Incluir: contexto, necesidades, alcance propuesto, supuestos, exclusiones, siguientes pasos.
3. NO inventar servicios ni capacidades. Ser genérico donde falte información.
4. Marcar explícitamente los SUPUESTOS.
5. Incluir riesgos y consideraciones.
6. Máximo 500 palabras.

FORMATO JSON:
{
  "title": "Título del brief",
  "context": "Contexto del prospecto y la reunión",
  "needs": ["Necesidad 1", "Necesidad 2"],
  "proposed_scope": "Alcance propuesto en párrafo",
  "assumptions": ["Supuesto 1", "Supuesto 2"],
  "exclusions": ["Exclusión 1"],
  "risks": ["Riesgo 1"],
  "next_steps": ["Paso 1", "Paso 2"],
  "estimated_timeline": "Estimación general de tiempo"
}`;

    return this.generateArtifact(prompt, MODELS.PRO);
  }

  // ─── QA Check ────────────────────────────────────────────────────

  async qaCheck(artifactContent: string, artifactType: string, sourceContext: string): Promise<QAResult> {
    const prompt = `Eres un revisor de calidad para artefactos generados por IA en un contexto comercial.

TIPO DE ARTEFACTO: ${artifactType}
CONTEXTO FUENTE (reunión/nota original):
${sourceContext.slice(0, 2000)}

ARTEFACTO A REVISAR:
${artifactContent}

VERIFICA:
1. ¿El contenido es consistente con la fuente? ¿No inventa datos?
2. ¿El tono es apropiado para el tipo de artefacto?
3. ¿Hay promesas comerciales no respaldadas por la fuente?
4. ¿Faltan datos críticos que deberían estar presentes?
5. ¿Hay información personal (PII) innecesaria?
6. ¿El CTA/siguiente paso es claro y accionable?

RESPONDE EN JSON:
{
  "passed": true/false,
  "issues": ["Problema 1 encontrado", "Problema 2"]
}

Si no hay problemas, devuelve: { "passed": true, "issues": [] }`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: MODELS.FAST,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });

      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text()) as QAResult;
    } catch (err) {
      console.error('[WorkflowAI] QA check error:', err);
      return { passed: true, issues: ['QA check no pudo ejecutarse'] };
    }
  }

  // ─── Generic Artifact Generation ─────────────────────────────────

  private async generateArtifact(prompt: string, modelName: string): Promise<GeneratedArtifact> {
    const promptH = hashPrompt(prompt);

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const result = await model.generateContent(prompt);
      const content = result.response.text();

      return {
        content,
        metadata: JSON.parse(content),
        prompt_hash: promptH,
        model_used: modelName,
      };
    } catch (err) {
      console.error(`[WorkflowAI] Generation failed with ${modelName}:`, err);
      // Fallback
      try {
        const fallbackModel = this.genAI.getGenerativeModel({
          model: MODELS.FALLBACK,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
        });
        const result = await fallbackModel.generateContent(prompt);
        const content = result.response.text();
        return {
          content,
          metadata: JSON.parse(content),
          prompt_hash: promptH,
          model_used: MODELS.FALLBACK,
        };
      } catch (fallbackErr) {
        console.error('[WorkflowAI] Fallback generation also failed:', fallbackErr);
        throw fallbackErr;
      }
    }
  }
}
