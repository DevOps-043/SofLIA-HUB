import { GoogleGenerativeAI } from '@google/generative-ai';
import { MeetingContextPackLoader, type MeetingContextPack, type MeetingTypeDefinition } from './meeting-context-pack';
import type {
  MeetingAnalysisDecisionItem,
  MeetingAnalysisDestinationRecommendation,
  MeetingAnalysisFollowUpRecommendation,
  MeetingAnalysisMessageDraft,
  MeetingAnalysisResult,
  MeetingAnalysisRiskItem,
  MeetingAnalysisTaskItem,
  MeetingAssetPayload,
  MeetingCommitment,
  MeetingDecision,
  MeetingIssue,
  MeetingOpenQuestion,
  MeetingParkingLotItem,
  MeetingParticipant,
  MeetingSourceArtifactRecord,
} from './meeting-types';

interface ExtractMeetingAssetInput {
  traceId: string;
  meetingRunId: string;
  meetingTitle: string | null;
  meetingType: string;
  sourceArtifact: MeetingSourceArtifactRecord;
}

interface ExtractMeetingAssetResult {
  payload: MeetingAssetPayload;
  confidence: number | null;
}

interface LegacySignal {
  value: string;
  evidence: string[];
  confidence: number;
}

const EXTRACTION_MODEL = 'gemini-2.5-flash';
const MAX_SOURCE_TEXT_CHARS = 16000;
const LOW_CONFIDENCE_TASK_STATE_THRESHOLD = 0.65;
const ALLOWED_DESTINATIONS = ['IRIS', 'Project Hub', 'Team', 'Project', 'None'] as const;
const ALLOWED_FOLLOW_UP_TYPES = ['meeting', 'message', 'validation', 'reminder', 'escalation'] as const;
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const DEFAULT_BLOCKED_ACTIONS = [
  'mensajes externos automaticos',
  'creacion final de compromisos no aprobados',
  'asignacion definitiva de responsables sin revision',
  'cambios de estado formales en sistemas de registro',
];

export class MeetingAIService {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;
  private readonly contextPackLoader = new MeetingContextPackLoader();

  setApiKey(apiKey: string | null): void {
    this.apiKey = apiKey?.trim() || null;
    this.genAI = null;
  }

  async extractMeetingAsset(input: ExtractMeetingAssetInput): Promise<ExtractMeetingAssetResult> {
    const contextPack = await this.contextPackLoader.load();
    const aiOutput = await this.tryExtractWithAI(input, contextPack);
    const normalizedAnalysis = this.normalizeAnalysisResult(aiOutput, input, contextPack);
    const payload = this.toMeetingAssetPayload(normalizedAnalysis, input);
    return {
      payload,
      confidence: normalizedAnalysis.meetingType.confidence,
    };
  }

  // ── PHASE 1: CLASSIFY ──────────────────────────────────────────────

  private async tryExtractWithAI(
    input: ExtractMeetingAssetInput,
    contextPack: MeetingContextPack,
  ): Promise<unknown | null> {
    if (!this.apiKey) return null;

    try {
      if (!this.genAI) {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
      }

      const model = this.genAI.getGenerativeModel({
        model: EXTRACTION_MODEL,
        generationConfig: { responseMimeType: 'application/json' },
      });

      // Fase 1: Clasificar tipo de reunion
      const classificationPrompt = this.buildClassificationPrompt(input, contextPack);
      const classificationResult = await model.generateContent(classificationPrompt);
      const classification = this.parseJson<{
        suggestedType?: string;
        alternativeTypes?: unknown[];
        confidence?: number;
        reason?: string;
        relevantSignals?: string[];
        detectedContext?: { project?: string; team?: string; meetingObjective?: string[] };
      }>(classificationResult.response.text());

      // Resolver tipo y definicion
      const allowedTypes = new Set(contextPack.meetingTypes.map((mt) => mt.id));
      let resolvedType = classification?.suggestedType || 'fallback_general_operational';
      if (!allowedTypes.has(resolvedType)) resolvedType = 'fallback_general_operational';

      const resolvedConfidence = this.clampNumber(
        typeof classification?.confidence === 'number' ? classification.confidence : 0.4,
        0.05, 0.97,
      );
      if (resolvedConfidence < contextPack.fallbackThreshold) {
        resolvedType = 'fallback_general_operational';
      }

      const typeDefinition = this.getMeetingTypeDefinition(contextPack, resolvedType)
        || this.getMeetingTypeDefinition(contextPack, 'fallback_general_operational')!;

      console.log(`[MeetingAIService] Fase 1 completa: tipo=${resolvedType}, confianza=${resolvedConfidence.toFixed(2)}`);

      // Fase 2: Extraer con prompt unico para este tipo
      const extractionPrompt = this.buildExtractionPrompt(
        input, contextPack, typeDefinition, resolvedType, resolvedConfidence,
        classification?.reason || '',
        classification?.relevantSignals || [],
        classification?.alternativeTypes || [],
        classification?.detectedContext || {},
      );
      const extractionResult = await model.generateContent(extractionPrompt);
      const extraction = this.parseJson<unknown>(extractionResult.response.text());

      console.log(`[MeetingAIService] Fase 2 completa: extraccion con estrategia ${typeDefinition.displayName}`);

      // Inyectar clasificacion en la respuesta para que normalize la use
      if (extraction && typeof extraction === 'object') {
        const obj = extraction as Record<string, unknown>;
        if (!obj.meetingType || typeof obj.meetingType !== 'object') {
          obj.meetingType = {};
        }
        const mt = obj.meetingType as Record<string, unknown>;
        mt.suggestedType = resolvedType;
        mt.confidence = resolvedConfidence;
        mt.reason = classification?.reason || mt.reason;
        mt.alternativeTypes = classification?.alternativeTypes || mt.alternativeTypes;
      }

      return extraction;
    } catch (error) {
      console.warn('[MeetingAIService] AI extraction failed, using fallback:', error);
      return null;
    }
  }

  // ── PHASE 1 PROMPT: CLASSIFICATION ──────────────────────────────────

  private buildClassificationPrompt(input: ExtractMeetingAssetInput, contextPack: MeetingContextPack): string {
    const transcriptPreview = input.sourceArtifact.normalized_text.slice(0, 6000);
    const compactRegistry = contextPack.meetingTypes.map((mt) => ({
      id: mt.id,
      displayName: mt.displayName,
      purpose: mt.purpose,
      cadence: mt.cadence,
      titleKeywords: mt.titleKeywords,
      languagePatterns: mt.languagePatterns,
      structuralSignals: mt.structuralSignals,
      negativeSignals: mt.negativeSignals,
      commonConfusions: mt.commonConfusions,
      confidenceHints: mt.confidenceHints,
    }));

    return [
      'Eres el clasificador de reuniones de SofLIA. Tu UNICA tarea es determinar el tipo de reunion.',
      'NO extraigas minuta, NO resumas, NO generes tareas. Solo clasifica.',
      '',
      '### TAXONOMIA DE TIPOS DE REUNION',
      JSON.stringify(compactRegistry, null, 2),
      '',
      '### REGLAS DE CLASIFICACION',
      '- Evalua senales positivas y negativas por tipo.',
      '- Genera un tipo sugerido (suggestedType) y hasta 3 alternativos.',
      `- Si confidence < ${contextPack.fallbackThreshold.toFixed(2)}, usa "fallback_general_operational".`,
      `- Si confidence esta entre ${contextPack.fallbackThreshold.toFixed(2)} y ${contextPack.reducedAggressivenessUpper.toFixed(2)}, marca como confianza media.`,
      '- Sube confianza cuando varias senales convergen: titulo + estructura + lenguaje.',
      '- Baja confianza si hay senales negativas o confusion con otros tipos.',
      '- No inventes — si no hay senales claras, usa fallback.',
      '',
      '### INPUT',
      JSON.stringify({
        title: input.meetingTitle || null,
        meetingTypeHint: input.meetingType || null,
        sourceType: input.sourceArtifact.source_type,
        transcriptPreview,
      }, null, 2),
      '',
      '### FORMATO DE RESPUESTA (JSON estricto)',
      JSON.stringify({
        suggestedType: 'id_del_tipo',
        alternativeTypes: [{ type: 'otro_id', confidence: 0.5, reason: 'razon' }],
        confidence: 0.85,
        reason: 'Explicacion de por que este tipo',
        relevantSignals: ['titulo:keyword', 'lenguaje:pattern', 'estructura:signal'],
        detectedContext: {
          project: 'nombre_proyecto_o_null',
          team: 'nombre_equipo_o_null',
          meetingObjective: ['objetivo1', 'objetivo2'],
        },
      }, null, 2),
      '',
      'Devuelve SOLO JSON valido, sin markdown ni texto adicional.',
    ].join('\n');
  }

  // ── PHASE 2 PROMPT: TYPE-SPECIFIC EXTRACTION ────────────────────────

  private buildExtractionPrompt(
    input: ExtractMeetingAssetInput,
    contextPack: MeetingContextPack,
    typeDefinition: MeetingTypeDefinition,
    resolvedType: string,
    resolvedConfidence: number,
    classificationReason: string,
    relevantSignals: string[],
    alternativeTypes: unknown[],
    detectedContext: Record<string, unknown>,
  ): string {
    const transcriptFull = input.sourceArtifact.normalized_text.slice(0, MAX_SOURCE_TEXT_CHARS);
    const isLowConfidence = resolvedConfidence < contextPack.reducedAggressivenessUpper;

    const meetingInput = {
      meetingId: input.meetingRunId,
      title: input.meetingTitle || null,
      description: this.describeSource(input.sourceArtifact),
      participants: this.extractParticipants(this.getLines(input.sourceArtifact.normalized_text)).map((p) => ({
        name: p.display_name,
        role: null,
        email: p.email || null,
      })),
      dateTime: this.extractDateTimeHint(input.sourceArtifact),
      transcriptRaw: transcriptFull,
    };

    // Bloque de estrategia especifica del tipo
    const strategyBlock = [
      `## TIPO DE REUNION CLASIFICADO: ${typeDefinition.displayName} (${resolvedType})`,
      `Confianza de clasificacion: ${resolvedConfidence.toFixed(2)}`,
      `Razon: ${classificationReason}`,
      '',
      `### PROPOSITO DE ESTE TIPO`,
      typeDefinition.purpose,
      '',
      `### ESTRUCTURA ESPERADA`,
      `Esta reunion deberia tener estas secciones:`,
      ...typeDefinition.expectedStructure.map((s) => `- ${s}`),
      '',
      `### FOCO DE EXTRACCION (QUE BUSCAR)`,
      `Prioriza extraer esta informacion del texto:`,
      ...typeDefinition.extractionFocus.map((f) => `- ${f}`),
      '',
      `### OUTPUTS DE ALTO VALOR`,
      `Lo mas valioso que puedes producir para este tipo de reunion:`,
      ...typeDefinition.highValueOutputs.map((o) => `- ${o}`),
      '',
      `### CONTEXTO DE DESTINO`,
      `Destino por defecto: ${typeDefinition.defaultDestination}`,
      typeDefinition.routingNotes ? `Nota de routing: ${typeDefinition.routingNotes}` : '',
      '',
      `### CONFUSIONES COMUNES`,
      typeDefinition.commonConfusions.length > 0
        ? `Este tipo se confunde frecuentemente con: ${typeDefinition.commonConfusions.join(', ')}. Asegurate de que las senales correspondan.`
        : 'Sin confusiones comunes registradas.',
    ];

    // Reglas de prudencia cuando la confianza es baja
    const prudenceBlock = isLowConfidence ? [
      '',
      '### MODO PRUDENTE (confianza media-baja)',
      '- Reduce la agresividad de recomendaciones.',
      '- Solo incluye tareas con evidencia clara (confidence >= 0.68).',
      '- No sugieras owners sin senales fuertes.',
      '- No inventes fechas limite.',
      '- Limita tareas a las mas claras (max 4).',
      '- Prefiere destino "None" si no hay senales claras de routing.',
    ] : [];

    return [
      'Eres el motor de extraccion de Meeting Intelligence de SofLIA.',
      'La reunion YA fue clasificada. Tu tarea es EXTRAER la minuta operativa usando la estrategia especifica de este tipo.',
      'NO reclasifiques. Usa el tipo y estrategia que te doy.',
      '',
      ...strategyBlock,
      ...prudenceBlock,
      '',
      '### REGLAS DE EXTRACCION',
      contextPack.extractionRulesRaw,
      '',
      '### SCHEMA DE SALIDA',
      contextPack.outputSchemaRaw,
      '',
      '### REGLAS DURAS',
      '- No inventes datos. Si no hay evidencia, deja el campo vacio o con confidence baja.',
      '- Separa hechos explicitos de inferencias.',
      '- Toda accion sensible requiere aprobacion humana (requiresHumanApproval: true).',
      '- Cada tarea debe tener verbo accionable.',
      '- No confundas "tema conversado" con "tarea aprobada".',
      '- No trates hipotesis como decision tomada.',
      '- Incluye evidence (citas cortas del texto) en decisions, tasks, risks.',
      '- Devuelve SOLO JSON valido, sin markdown ni texto adicional.',
      '',
      '### CLASIFICACION YA RESUELTA (no cambiar)',
      JSON.stringify({
        meetingType: {
          suggestedType: resolvedType,
          alternativeTypes,
          confidence: resolvedConfidence,
          reason: classificationReason,
        },
        detectedContext: {
          ...detectedContext,
          relevantSignals,
        },
        analysisStrategy: {
          strategyId: resolvedType,
          strategyName: typeDefinition.displayName,
          whyThisStrategy: `Estrategia seleccionada por clasificacion como ${typeDefinition.displayName}: ${classificationReason}`,
          extractionFocus: typeDefinition.extractionFocus,
        },
      }, null, 2),
      '',
      '### TRANSCRIPCION / TEXTO FUENTE',
      JSON.stringify(meetingInput, null, 2),
    ].join('\n');
  }

  private normalizeAnalysisResult(
    rawAnalysis: unknown | null,
    input: ExtractMeetingAssetInput,
    contextPack: MeetingContextPack,
  ): MeetingAnalysisResult {
    const fallback = this.buildFallbackAnalysis(input, contextPack);
    if (!rawAnalysis || typeof rawAnalysis !== 'object') {
      return fallback;
    }

    const rawObject = rawAnalysis as Record<string, unknown>;
    const allowedTypes = new Set(contextPack.meetingTypes.map((meetingType) => meetingType.id));
    const rawMeetingType = this.getObject(rawObject.meetingType);
    let suggestedType = this.asString(rawMeetingType?.suggestedType) || fallback.meetingType.suggestedType;
    if (!allowedTypes.has(suggestedType)) {
      suggestedType = fallback.meetingType.suggestedType;
    }

    const typeConfidence = this.asConfidence(rawMeetingType?.confidence, fallback.meetingType.confidence);
    if (typeConfidence < contextPack.fallbackThreshold) {
      suggestedType = 'fallback_general_operational';
    }

    const typeDefinition = this.getMeetingTypeDefinition(contextPack, suggestedType)
      || this.getMeetingTypeDefinition(contextPack, 'fallback_general_operational');
    const detectedContext = this.getObject(rawObject.detectedContext);
    const analysisStrategy = this.getObject(rawObject.analysisStrategy);
    const relevantSignals = this.limitStrings(this.asStringArray(detectedContext?.relevantSignals), 8);
    const meetingObjective = this.limitStrings(this.asStringArray(detectedContext?.meetingObjective), 6);
    const reason = this.asString(rawMeetingType?.reason)
      || this.buildMeetingTypeReason(typeDefinition, relevantSignals, typeConfidence, fallback.meetingType.reason);

    const normalized: MeetingAnalysisResult = {
      meetingType: {
        suggestedType,
        alternativeTypes: this.normalizeAlternativeTypes(rawMeetingType?.alternativeTypes, fallback, allowedTypes),
        confidence: typeConfidence,
        reason,
      },
      detectedContext: {
        project: this.asNullableString(detectedContext?.project),
        team: this.asNullableString(detectedContext?.team),
        meetingObjective: meetingObjective.length > 0 ? meetingObjective : fallback.detectedContext.meetingObjective,
        relevantSignals: relevantSignals.length > 0 ? relevantSignals : fallback.detectedContext.relevantSignals,
      },
      analysisStrategy: {
        strategyId: this.asString(analysisStrategy?.strategyId) || suggestedType,
        strategyName: this.asString(analysisStrategy?.strategyName)
          || typeDefinition?.displayName
          || fallback.analysisStrategy.strategyName,
        whyThisStrategy: this.asString(analysisStrategy?.whyThisStrategy)
          || this.buildStrategyReason(typeDefinition, relevantSignals, reason),
        extractionFocus: this.limitStrings(this.asStringArray(analysisStrategy?.extractionFocus), 8),
      },
      executiveSummary: this.asString(rawObject.executiveSummary) || fallback.executiveSummary,
      keyPoints: this.normalizeStringItems(rawObject.keyPoints),
      decisions: this.normalizeDecisions(rawObject.decisions),
      agreements: this.normalizeAgreements(rawObject.agreements),
      tasks: this.normalizeTasks(rawObject.tasks),
      risks: this.normalizeRisks(rawObject.risks),
      openQuestions: this.normalizeOpenQuestions(rawObject.openQuestions),
      unresolvedItems: this.normalizeUnresolvedItems(rawObject.unresolvedItems),
      followUpRecommendation: this.normalizeFollowUp(rawObject.followUpRecommendation, fallback.followUpRecommendation),
      destinationRecommendation: this.normalizeDestination(rawObject.destinationRecommendation, fallback.destinationRecommendation),
      messageDrafts: this.normalizeMessageDrafts(rawObject.messageDrafts),
      governance: this.normalizeGovernance(rawObject.governance),
    };

    if (normalized.analysisStrategy.extractionFocus.length === 0) {
      normalized.analysisStrategy.extractionFocus = typeDefinition?.extractionFocus || fallback.analysisStrategy.extractionFocus;
    }
    if (normalized.keyPoints.length === 0) {
      normalized.keyPoints = fallback.keyPoints;
    }
    if (normalized.decisions.length === 0) {
      normalized.decisions = fallback.decisions;
    }
    if (normalized.agreements.length === 0) {
      normalized.agreements = fallback.agreements;
    }
    if (normalized.tasks.length === 0) {
      normalized.tasks = fallback.tasks;
    }
    if (normalized.risks.length === 0) {
      normalized.risks = fallback.risks;
    }
    if (normalized.openQuestions.length === 0) {
      normalized.openQuestions = fallback.openQuestions;
    }
    if (normalized.unresolvedItems.length === 0) {
      normalized.unresolvedItems = fallback.unresolvedItems;
    }

    if (normalized.meetingType.confidence < contextPack.fallbackThreshold) {
      normalized.destinationRecommendation = {
        suggestedDestination: 'None',
        confidence: Math.min(normalized.destinationRecommendation.confidence, 0.45),
        reason: normalized.destinationRecommendation.reason || 'La clasificacion es fragil y requiere revision humana.',
      };
    } else if (normalized.meetingType.confidence <= contextPack.reducedAggressivenessUpper) {
      normalized.tasks = normalized.tasks
        .filter((task) => task.confidence >= 0.68)
        .slice(0, 4);
      normalized.messageDrafts = (normalized.messageDrafts || []).filter((draft) => draft.kind !== 'owner_confirmation');
    }

    normalized.governance = {
      autonomyLevelApplied: Math.min(Math.max(normalized.governance.autonomyLevelApplied, 0), 2),
      sensitiveActionsBlocked: normalized.governance.sensitiveActionsBlocked.length > 0
        ? normalized.governance.sensitiveActionsBlocked
        : DEFAULT_BLOCKED_ACTIONS,
      requiresHumanApproval: true,
      explanationVisible: true,
    };

    normalized.tasks = normalized.tasks.map((task) => ({
      ...task,
      requiresHumanReview: true,
    }));

    return normalized;
  }

  private buildFallbackAnalysis(input: ExtractMeetingAssetInput, contextPack: MeetingContextPack): MeetingAnalysisResult {
    const lines = this.getLines(input.sourceArtifact.normalized_text);
    const classification = this.classifyMeeting(input, contextPack);
    const decisions = this.extractDecisionSignals(lines);
    const agreements = this.extractAgreementSignals(lines);
    const tasks = this.extractTaskSignals(lines);
    const risks = this.extractRiskSignals(lines);
    const openQuestions = this.extractOpenQuestionSignals(lines);
    const unresolvedItems = this.extractUnresolvedSignals(lines, risks);
    const keyPoints = this.buildKeyPoints(lines, tasks, risks, decisions);
    const followUpRecommendation = this.buildFollowUpRecommendation(tasks, risks, openQuestions);
    const destinationRecommendation = this.buildDestinationRecommendation(
      classification.suggestedType,
      classification.confidence,
      classification.reason,
      contextPack,
    );

    return {
      meetingType: {
        suggestedType: classification.suggestedType,
        alternativeTypes: classification.alternativeTypes,
        confidence: classification.confidence,
        reason: classification.reason,
      },
      detectedContext: {
        project: null,
        team: null,
        meetingObjective: classification.objectives,
        relevantSignals: classification.relevantSignals,
      },
      analysisStrategy: {
        strategyId: classification.suggestedType,
        strategyName: classification.strategyName,
        whyThisStrategy: classification.strategyReason,
        extractionFocus: classification.extractionFocus,
      },
      executiveSummary: this.buildExecutiveSummary(lines, tasks.length, decisions.length, risks.length),
      keyPoints,
      decisions: decisions.map((decision) => ({
        description: decision.value,
        confidence: decision.confidence,
        evidence: decision.evidence,
      })),
      agreements: agreements.map((agreement) => ({
        description: agreement.value,
        confidence: agreement.confidence,
        evidence: agreement.evidence,
      })),
      tasks,
      risks,
      openQuestions,
      unresolvedItems,
      followUpRecommendation,
      destinationRecommendation,
      messageDrafts: this.buildMessageDrafts(destinationRecommendation, followUpRecommendation, keyPoints, tasks),
      governance: {
        autonomyLevelApplied: 2,
        sensitiveActionsBlocked: DEFAULT_BLOCKED_ACTIONS,
        requiresHumanApproval: true,
        explanationVisible: true,
      },
    };
  }

  private classifyMeeting(input: ExtractMeetingAssetInput, contextPack: MeetingContextPack) {
    const title = this.normalizeText(input.meetingTitle || '');
    const body = this.normalizeText(input.sourceArtifact.normalized_text);
    const hint = this.normalizeText(input.meetingType);
    const candidates = contextPack.meetingTypes
      .filter((meetingType) => meetingType.id !== 'fallback_general_operational')
      .map((meetingType) => {
        const titleMatches = meetingType.titleKeywords.filter((keyword) => title.includes(this.normalizeText(keyword)));
        const languageMatches = meetingType.languagePatterns.filter((pattern) => body.includes(this.normalizeText(pattern)));
        const structuralMatches = meetingType.structuralSignals.filter((signal) => body.includes(this.normalizeText(signal)));
        const negativeMatches = meetingType.negativeSignals.filter((signal) => body.includes(this.normalizeText(signal)));
        const hintMatch = hint && [meetingType.id, meetingType.displayName].some((token) => hint.includes(this.normalizeText(token)));

        const score = 0.18 * Math.min(titleMatches.length, 2)
          + 0.07 * Math.min(languageMatches.length, 4)
          + 0.06 * Math.min(structuralMatches.length, 3)
          + (hintMatch ? 0.08 : 0)
          - 0.1 * Math.min(negativeMatches.length, 2);

        const confidence = this.clampNumber((score > 0 ? 0.18 : 0.08) + score, 0.05, 0.97);
        const relevantSignals = [
          ...titleMatches.map((match) => `titulo:${match}`),
          ...languageMatches.slice(0, 3).map((match) => `lenguaje:${match}`),
          ...structuralMatches.slice(0, 2).map((match) => `estructura:${match}`),
        ];

        return {
          meetingType,
          confidence,
          relevantSignals,
          reason: relevantSignals.length > 0
            ? `Coinciden senales con ${meetingType.displayName}: ${relevantSignals.join(', ')}.`
            : `Hay senales parciales para ${meetingType.displayName}, pero el texto es limitado.`,
        };
      })
      .sort((left, right) => right.confidence - left.confidence);

    const fallbackDefinition = this.getMeetingTypeDefinition(contextPack, 'fallback_general_operational');
    const bestMatch = candidates[0];
    if (!bestMatch || bestMatch.confidence < contextPack.fallbackThreshold || !fallbackDefinition) {
      return {
        suggestedType: 'fallback_general_operational',
        confidence: bestMatch ? Math.min(bestMatch.confidence, 0.55) : 0.35,
        reason: bestMatch
          ? `La clasificacion es ambigua. La mejor coincidencia fue ${bestMatch.meetingType.displayName}, pero no supera el umbral de ${contextPack.fallbackThreshold.toFixed(2)}.`
          : 'No hay senales suficientes para una taxonomia especifica.',
        relevantSignals: bestMatch?.relevantSignals || [],
        objectives: fallbackDefinition?.extractionFocus || ['resultado operativo minimo seguro'],
        strategyName: fallbackDefinition?.displayName || 'Fallback General Operational Meeting',
        strategyReason: 'Se usa el modo fallback por baja confianza o senales insuficientes.',
        extractionFocus: fallbackDefinition?.extractionFocus || ['resultado operativo minimo seguro'],
        alternativeTypes: candidates.slice(0, 3).map((candidate) => ({
          type: candidate.meetingType.id,
          confidence: candidate.confidence,
          reason: candidate.reason,
        })),
      };
    }

    return {
      suggestedType: bestMatch.meetingType.id,
      confidence: bestMatch.confidence,
      reason: bestMatch.reason,
      relevantSignals: bestMatch.relevantSignals,
      objectives: bestMatch.meetingType.expectedStructure.slice(0, 4),
      strategyName: bestMatch.meetingType.displayName,
      strategyReason: `Se selecciono la estrategia de ${bestMatch.meetingType.displayName} por convergencia de senales.`,
      extractionFocus: bestMatch.meetingType.extractionFocus,
      alternativeTypes: candidates
        .slice(1, 4)
        .map((candidate) => ({
          type: candidate.meetingType.id,
          confidence: candidate.confidence,
          reason: candidate.reason,
        })),
    };
  }

  private toMeetingAssetPayload(analysis: MeetingAnalysisResult, input: ExtractMeetingAssetInput): MeetingAssetPayload {
    const lines = this.getLines(input.sourceArtifact.normalized_text);
    const sourceArtifactId = input.sourceArtifact.id;
    const participants = this.extractParticipants(lines);
    const decisions = analysis.decisions.map((decision) => this.toLegacyDecision(decision));
    const commitments = analysis.tasks.map((task) => this.toLegacyCommitment(task));
    const issues = analysis.risks.map((risk) => this.toLegacyRisk(risk));
    const openQuestions = analysis.openQuestions.map((question) => this.toLegacyOpenQuestion(question));
    const parkingLot = analysis.unresolvedItems.map((item) => this.toLegacyParkingLot(item));
    const continuityContext = [
      ...analysis.tasks.map((task) => `Seguimiento: ${task.description}`),
      ...analysis.openQuestions.map((question) => `Pregunta abierta: ${question.question}`),
      ...analysis.unresolvedItems.map((item) => `Pendiente: ${item.item}`),
    ].slice(0, 8);

    return {
      schema_version: 'meeting_asset.v1',
      meeting_run_id: input.meetingRunId,
      trace_id: input.traceId,
      meeting_title: input.meetingTitle || this.inferTitle(lines) || 'Reunion sin titulo',
      meeting_type: analysis.meetingType.suggestedType,
      source_refs: [{
        source_artifact_id: sourceArtifactId,
        source_type: input.sourceArtifact.source_type,
        source_uri: input.sourceArtifact.source_uri,
      }],
      participants,
      decisions: this.attachEvidence(decisions, [{ source_artifact_id: sourceArtifactId }]),
      commitments: this.attachEvidence(commitments, [{ source_artifact_id: sourceArtifactId }]),
      issues: this.attachEvidence(issues, [{ source_artifact_id: sourceArtifactId }]),
      open_questions: this.attachEvidence(openQuestions, [{ source_artifact_id: sourceArtifactId }]),
      parking_lot: this.attachEvidence(parkingLot, [{ source_artifact_id: sourceArtifactId }]),
      executive_summary: analysis.executiveSummary,
      operational_summary: this.buildOperationalSummary(analysis),
      review_flags: [],
      proposed_actions: [],
      continuity_context: Array.from(new Set(continuityContext)),
      analysis_result: {
        ...analysis,
        messageDrafts: (analysis.messageDrafts || []).map((draft) => ({
          ...draft,
          requiresApproval: true,
        })),
        governance: {
          autonomyLevelApplied: Math.min(Math.max(analysis.governance.autonomyLevelApplied, 0), 2),
          sensitiveActionsBlocked: analysis.governance.sensitiveActionsBlocked.length > 0
            ? analysis.governance.sensitiveActionsBlocked
            : DEFAULT_BLOCKED_ACTIONS,
          requiresHumanApproval: true,
          explanationVisible: true,
        },
      },
    };
  }

  private toLegacyDecision(decision: MeetingAnalysisDecisionItem): MeetingDecision {
    return {
      statement: decision.description,
      owner_candidate: null,
      approval_state: 'needs_review',
      evidence_refs: (decision.evidence || []).map((evidence) => ({ excerpt: evidence })),
      confidence: decision.confidence,
    };
  }

  private toLegacyCommitment(task: MeetingAnalysisTaskItem): MeetingCommitment {
    return {
      statement: task.description,
      owner_candidate: task.ownerSuggested || null,
      due_date_candidate: this.toIsoDateOrNull(task.dueDateSuggested),
      status: task.confidence < LOW_CONFIDENCE_TASK_STATE_THRESHOLD ? 'needs_clarification' : 'open',
      project_target: null,
      evidence_refs: (task.evidence || []).map((evidence) => ({ excerpt: evidence })),
      confidence: task.confidence,
    };
  }

  private toLegacyRisk(risk: MeetingAnalysisRiskItem): MeetingIssue {
    const severity = risk.severity === 'critical' ? 'high' : risk.severity || 'medium';
    return {
      statement: risk.description,
      severity,
      owner_candidate: null,
      evidence_refs: risk.reason ? [{ excerpt: risk.reason }] : [],
      confidence: risk.confidence,
    };
  }

  private toLegacyOpenQuestion(question: MeetingAnalysisResult['openQuestions'][number]): MeetingOpenQuestion {
    return {
      question: question.question,
      owner_candidate: null,
      evidence_refs: [],
    };
  }

  private toLegacyParkingLot(item: MeetingAnalysisResult['unresolvedItems'][number]): MeetingParkingLotItem {
    return {
      statement: `${item.item} (${item.reasonOpen})`,
      evidence_refs: [],
    };
  }

  private buildOperationalSummary(analysis: MeetingAnalysisResult): string {
    const parts = [
      analysis.keyPoints.slice(0, 3).join(' '),
      `Destino sugerido: ${analysis.destinationRecommendation.suggestedDestination}.`,
      analysis.followUpRecommendation.suggested
        ? `Follow-up sugerido: ${analysis.followUpRecommendation.description || analysis.followUpRecommendation.type || 'validacion manual'}.`
        : null,
    ].filter(Boolean);

    return parts.join(' ').trim() || analysis.executiveSummary;
  }

  private buildMeetingTypeReason(
    meetingType: MeetingTypeDefinition | null,
    relevantSignals: string[],
    confidence: number,
    fallbackReason: string,
  ): string {
    if (meetingType && relevantSignals.length > 0) {
      return `Clasifique como ${meetingType.displayName} por estas senales: ${relevantSignals.join(', ')}. Confianza ${confidence.toFixed(2)}.`;
    }
    if (meetingType) {
      return `Clasifique como ${meetingType.displayName} con confianza ${confidence.toFixed(2)} y senales limitadas.`;
    }
    return fallbackReason;
  }

  private buildStrategyReason(meetingType: MeetingTypeDefinition | null, relevantSignals: string[], fallbackReason: string): string {
    if (meetingType) {
      const signals = relevantSignals.length > 0 ? ` Senales: ${relevantSignals.join(', ')}.` : '';
      return `La estrategia de ${meetingType.displayName} prioriza ${meetingType.extractionFocus.join(', ')}.${signals}`;
    }
    return fallbackReason;
  }

  private normalizeAlternativeTypes(
    raw: unknown,
    fallback: MeetingAnalysisResult,
    allowedTypes: Set<string>,
  ): MeetingAnalysisResult['meetingType']['alternativeTypes'] {
    if (!Array.isArray(raw)) {
      return fallback.meetingType.alternativeTypes;
    }

    const normalized = raw
      .map((item) => {
        const source = this.getObject(item);
        return {
          type: this.asString(source?.type),
          confidence: this.asConfidence(source?.confidence, 0.4),
          reason: this.asString(source?.reason) || 'Tipo alternativo sugerido por senales parciales.',
        };
      })
      .filter((item) => item.type && allowedTypes.has(item.type));

    return normalized.length > 0 ? normalized.slice(0, 3) : fallback.meetingType.alternativeTypes;
  }

  private normalizeDecisions(raw: unknown): MeetingAnalysisResult['decisions'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = this.getObject(item);
        return {
          description: this.asString(source?.description),
          confidence: this.asConfidence(source?.confidence, 0.65),
          evidence: this.limitStrings(this.asStringArray(source?.evidence), 4),
        };
      })
      .filter((item) => item.description);
  }

  private normalizeAgreements(raw: unknown): MeetingAnalysisResult['agreements'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = this.getObject(item);
        return {
          description: this.asString(source?.description),
          confidence: this.asConfidence(source?.confidence, 0.65),
          evidence: this.limitStrings(this.asStringArray(source?.evidence), 4),
        };
      })
      .filter((item) => item.description);
  }

  private normalizeTasks(raw: unknown): MeetingAnalysisResult['tasks'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = this.getObject(item);
        return {
          description: this.asString(source?.description),
          ownerSuggested: this.asNullableString(source?.ownerSuggested),
          ownerConfidence: this.asOptionalConfidence(source?.ownerConfidence),
          dueDateSuggested: this.toIsoDateOrNull(this.asNullableString(source?.dueDateSuggested)),
          prioritySuggested: this.normalizePriority(source?.prioritySuggested),
          reason: this.asString(source?.reason) || 'Tarea sugerida con base en el contenido de la reunion.',
          confidence: this.asConfidence(source?.confidence, 0.68),
          requiresHumanReview: true,
          evidence: this.limitStrings(this.asStringArray(source?.evidence), 4),
        };
      })
      .filter((task) => task.description);
  }

  private normalizeRisks(raw: unknown): MeetingAnalysisResult['risks'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = this.getObject(item);
        return {
          description: this.asString(source?.description),
          severity: this.normalizeSeverity(source?.severity),
          confidence: this.asConfidence(source?.confidence, 0.65),
          reason: this.asString(source?.reason) || undefined,
        };
      })
      .filter((risk) => risk.description);
  }

  private normalizeOpenQuestions(raw: unknown): MeetingAnalysisResult['openQuestions'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = this.getObject(item);
        return {
          question: this.asString(source?.question),
          confidence: this.asConfidence(source?.confidence, 0.6),
        };
      })
      .filter((question) => question.question);
  }

  private normalizeUnresolvedItems(raw: unknown): MeetingAnalysisResult['unresolvedItems'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = this.getObject(item);
        return {
          item: this.asString(source?.item),
          reasonOpen: this.asString(source?.reasonOpen) || 'Pendiente de definicion o cierre.',
          confidence: this.asConfidence(source?.confidence, 0.6),
        };
      })
      .filter((item) => item.item);
  }

  private normalizeFollowUp(
    raw: unknown,
    fallback: MeetingAnalysisFollowUpRecommendation,
  ): MeetingAnalysisFollowUpRecommendation {
    const source = this.getObject(raw);
    const suggested = typeof source?.suggested === 'boolean' ? source.suggested : fallback.suggested;
    const type = this.normalizeFollowUpType(source?.type);
    return {
      suggested,
      type: suggested ? (type || fallback.type || 'validation') : undefined,
      description: suggested ? (this.asString(source?.description) || fallback.description) : undefined,
      confidence: this.asConfidence(source?.confidence, fallback.confidence),
      reason: this.asString(source?.reason) || fallback.reason,
    };
  }

  private normalizeDestination(
    raw: unknown,
    fallback: MeetingAnalysisDestinationRecommendation,
  ): MeetingAnalysisDestinationRecommendation {
    const source = this.getObject(raw);
    const suggestedDestination = this.normalizeDestinationValue(source?.suggestedDestination) || fallback.suggestedDestination;
    return {
      suggestedDestination,
      confidence: this.asConfidence(source?.confidence, fallback.confidence),
      reason: this.asString(source?.reason) || fallback.reason,
    };
  }

  private normalizeMessageDrafts(raw: unknown): MeetingAnalysisMessageDraft[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = this.getObject(item);
        return {
          kind: this.normalizeMessageKind(source?.kind),
          content: this.asString(source?.content),
          requiresApproval: true,
        };
      })
      .filter((draft): draft is MeetingAnalysisMessageDraft => Boolean(draft.kind && draft.content))
      .slice(0, 3);
  }

  private normalizeGovernance(raw: unknown): MeetingAnalysisResult['governance'] {
    const source = this.getObject(raw);
    return {
      autonomyLevelApplied: this.clampNumber(
        typeof source?.autonomyLevelApplied === 'number' ? source.autonomyLevelApplied : 2,
        0,
        2,
      ),
      sensitiveActionsBlocked: this.limitStrings(this.asStringArray(source?.sensitiveActionsBlocked), 8),
      requiresHumanApproval: typeof source?.requiresHumanApproval === 'boolean' ? source.requiresHumanApproval : true,
      explanationVisible: typeof source?.explanationVisible === 'boolean' ? source.explanationVisible : true,
    };
  }

  private extractDecisionSignals(lines: string[]): LegacySignal[] {
    return this.extractLegacySignals(lines, /^(?:[-*]\s*)?(decision|decisiones|acuerdo|approved)\b/i, 0.76);
  }

  private extractAgreementSignals(lines: string[]): LegacySignal[] {
    return this.extractLegacySignals(lines, /^(?:[-*]\s*)?(agreement|acuerdo|alineado|se acuerda)\b/i, 0.72);
  }

  private extractTaskSignals(lines: string[]): MeetingAnalysisResult['tasks'] {
    return lines
      .filter((line) => /^(?:[-*]\s*)?(accion|acci\u00f3n|tarea|compromiso|todo)\b/i.test(line) || /^\[\s?\]\s+/.test(line))
      .map((line) => {
        const ownerSuggested = this.extractOwnerCandidate(line);
        const dueDateSuggested = this.extractDueDate(line);
        return {
          description: this.stripLabel(line.replace(/^\[\s?\]\s+/, '')),
          ownerSuggested,
          ownerConfidence: ownerSuggested ? 0.7 : undefined,
          dueDateSuggested,
          prioritySuggested: this.inferPriority(line),
          reason: ownerSuggested || dueDateSuggested
            ? 'La tarea aparece formulada como accion o compromiso explicito.'
            : 'Hay una referencia explicita a una accion, pero faltan datos de cierre.',
          confidence: ownerSuggested || dueDateSuggested ? 0.76 : 0.68,
          requiresHumanReview: true,
          evidence: [line],
        };
      })
      .filter((task) => task.description.trim().length > 0);
  }

  private extractRiskSignals(lines: string[]): MeetingAnalysisResult['risks'] {
    return lines
      .filter((line) => /^(?:[-*]\s*)?(bloqueo|blocker|riesgo|issue|problema)\b/i.test(line))
      .map((line) => ({
        description: this.stripLabel(line),
        severity: this.inferSeverity(line),
        confidence: /critico|critical|alto/i.test(line) ? 0.82 : 0.7,
        reason: line,
      }));
  }

  private extractOpenQuestionSignals(lines: string[]): MeetingAnalysisResult['openQuestions'] {
    return lines
      .filter((line) => /^(?:[-*]\s*)?(pregunta|question|duda)\b/i.test(line))
      .map((line) => ({
        question: this.stripLabel(line),
        confidence: 0.68,
      }));
  }

  private extractUnresolvedSignals(
    lines: string[],
    risks: MeetingAnalysisResult['risks'],
  ): MeetingAnalysisResult['unresolvedItems'] {
    const explicit = lines
      .filter((line) => /^(?:[-*]\s*)?(parking|tema pendiente|backlog|pendiente)\b/i.test(line))
      .map((line) => ({
        item: this.stripLabel(line),
        reasonOpen: 'Quedo marcado como pendiente o parking lot.',
        confidence: 0.7,
      }));

    const derived = risks
      .filter((risk) => risk.severity === 'high' || risk.severity === 'critical')
      .map((risk) => ({
        item: risk.description,
        reasonOpen: 'El bloqueo o riesgo sigue sin cierre explicito.',
        confidence: Math.max(risk.confidence - 0.05, 0.6),
      }));

    return [...explicit, ...derived].slice(0, 6);
  }

  private buildKeyPoints(
    lines: string[],
    tasks: MeetingAnalysisResult['tasks'],
    risks: MeetingAnalysisResult['risks'],
    decisions: LegacySignal[],
  ): string[] {
    const keyPoints = [
      ...decisions.slice(0, 2).map((decision) => `Decision: ${decision.value}`),
      ...tasks.slice(0, 3).map((task) => `Accion: ${task.description}`),
      ...risks.slice(0, 2).map((risk) => `Riesgo: ${risk.description}`),
    ];

    if (keyPoints.length > 0) {
      return keyPoints;
    }

    return lines
      .filter((line) => line.length > 24)
      .slice(0, 4)
      .map((line) => line.length > 180 ? `${line.slice(0, 177).trim()}...` : line);
  }

  private buildFollowUpRecommendation(
    tasks: MeetingAnalysisResult['tasks'],
    risks: MeetingAnalysisResult['risks'],
    openQuestions: MeetingAnalysisResult['openQuestions'],
  ): MeetingAnalysisFollowUpRecommendation {
    if (openQuestions.length > 0) {
      return {
        suggested: true,
        type: 'validation',
        description: 'Resolver las preguntas abiertas y confirmar la interpretacion de la reunion.',
        confidence: 0.76,
        reason: 'Quedaron preguntas abiertas sin cierre explicito.',
      };
    }

    const tasksMissingOwner = tasks.filter((task) => !task.ownerSuggested);
    const tasksMissingDate = tasks.filter((task) => !task.dueDateSuggested);
    if (tasksMissingOwner.length > 0 || tasksMissingDate.length > 0) {
      return {
        suggested: true,
        type: 'message',
        description: 'Confirmar responsables y fechas de las tareas detectadas antes de sincronizar.',
        confidence: 0.72,
        reason: 'Hay tareas sin owner o sin fecha sugerida.',
      };
    }

    const criticalRisk = risks.find((risk) => risk.severity === 'critical' || risk.severity === 'high');
    if (criticalRisk) {
      return {
        suggested: true,
        type: 'escalation',
        description: `Escalar el riesgo principal: ${criticalRisk.description}.`,
        confidence: 0.74,
        reason: 'Se detecto un bloqueo o riesgo de severidad alta.',
      };
    }

    return {
      suggested: false,
      confidence: 0.6,
      reason: 'La reunion ya deja un siguiente paso razonablemente claro.',
    };
  }

  private buildDestinationRecommendation(
    suggestedType: string,
    confidence: number,
    reason: string,
    contextPack: MeetingContextPack,
  ): MeetingAnalysisDestinationRecommendation {
    if (confidence < contextPack.fallbackThreshold) {
      return {
        suggestedDestination: 'None',
        confidence: 0.4,
        reason: 'La clasificacion es baja y no conviene empujar un destino operativo todavia.',
      };
    }

    const meetingType = this.getMeetingTypeDefinition(contextPack, suggestedType);
    return {
      suggestedDestination: meetingType?.defaultDestination || 'None',
      confidence: Math.min(confidence, 0.86),
      reason,
    };
  }

  private buildMessageDrafts(
    destination: MeetingAnalysisDestinationRecommendation,
    followUp: MeetingAnalysisFollowUpRecommendation,
    keyPoints: string[],
    tasks: MeetingAnalysisResult['tasks'],
  ): MeetingAnalysisMessageDraft[] {
    const drafts: MeetingAnalysisMessageDraft[] = [];

    if (destination.suggestedDestination === 'Team' && keyPoints.length > 0) {
      drafts.push({
        kind: 'team_summary',
        content: [
          'Resumen operativo de la reunion:',
          ...keyPoints.slice(0, 4).map((point) => `- ${point}`),
        ].join('\n'),
        requiresApproval: true,
      });
    }

    if (followUp.suggested) {
      drafts.push({
        kind: 'follow_up',
        content: followUp.description || followUp.reason,
        requiresApproval: true,
      });
    }

    const ownerlessTask = tasks.find((task) => !task.ownerSuggested);
    if (ownerlessTask) {
      drafts.push({
        kind: 'owner_confirmation',
        content: `Confirmar responsable para: ${ownerlessTask.description}`,
        requiresApproval: true,
      });
    }

    return drafts.slice(0, 3);
  }

  private extractLegacySignals(lines: string[], pattern: RegExp, confidence: number): LegacySignal[] {
    return lines
      .filter((line) => pattern.test(line))
      .map((line) => ({
        value: this.stripLabel(line),
        evidence: [line],
        confidence,
      }));
  }

  private attachEvidence<T extends { evidence_refs?: Array<{ source_artifact_id?: string; excerpt?: string }> }>(
    items: T[],
    fallbackRefs: Array<{ source_artifact_id?: string; excerpt?: string }>,
  ): T[] {
    return items.map((item) => ({
      ...item,
      evidence_refs: Array.isArray(item.evidence_refs) && item.evidence_refs.length > 0 ? item.evidence_refs : fallbackRefs,
    }));
  }

  private extractParticipants(lines: string[]): MeetingParticipant[] {
    const participants: MeetingParticipant[] = [];
    for (const line of lines) {
      if (!/^(participantes?|asistentes?|attendees?)\s*:/i.test(line)) continue;
      const names = line.replace(/^[^:]+:/, '')
        .split(/[;,]/)
        .map((part) => part.trim())
        .filter(Boolean);
      for (const name of names) {
        const emailMatch = name.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        participants.push({
          display_name: name.replace(/[<(].*$/, '').trim(),
          email: emailMatch?.[0] || null,
          external: false,
          confidence: 0.7,
        });
      }
    }
    return participants;
  }

  private inferTitle(lines: string[]): string | null {
    const firstLine = lines.find((line) => line.length > 8);
    return firstLine ? firstLine.slice(0, 120) : null;
  }

  private buildExecutiveSummary(lines: string[], commitments: number, decisions: number, issues: number): string {
    const seed = lines.slice(0, 3).join(' ');
    return [
      seed ? seed.slice(0, 240) : 'Reunion importada para revision.',
      `Tareas detectadas: ${commitments}.`,
      `Decisiones detectadas: ${decisions}.`,
      issues > 0 ? `Riesgos o bloqueos detectados: ${issues}.` : null,
    ].filter(Boolean).join(' ');
  }

  private extractOwnerCandidate(line: string): string | null {
    const taggedOwner = line.match(/(?:owner|responsable|encargado|dueno|due\u00f1o)\s*[:=-]\s*([A-Za-z0-9 .@_-]+)/i);
    if (taggedOwner?.[1]) return taggedOwner[1].trim();

    const mention = line.match(/@([A-Za-z0-9._-]+)/);
    return mention?.[1] || null;
  }

  private extractDueDate(line: string): string | null {
    const isoDate = line.match(/(20\d{2}-\d{2}-\d{2})/);
    if (isoDate?.[1]) return isoDate[1];

    const slashDate = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!slashDate) return null;

    const day = slashDate[1].padStart(2, '0');
    const month = slashDate[2].padStart(2, '0');
    const year = slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
    return `${year}-${month}-${day}`;
  }

  private stripLabel(line: string): string {
    return line
      .replace(/^(?:[-*]\s*)?(\[\s?\]\s*)?([A-Za-záéíóúñÁÉÍÓÚÑ ]+)\s*:\s*/i, '')
      .trim();
  }

  private parseJson<T>(rawText: string): T {
    const normalized = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '');
    return JSON.parse(normalized) as T;
  }

  private getMeetingTypeDefinition(contextPack: MeetingContextPack, meetingTypeId: string): MeetingTypeDefinition | null {
    return contextPack.meetingTypes.find((meetingType) => meetingType.id === meetingTypeId) || null;
  }

  private getLines(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private describeSource(sourceArtifact: MeetingSourceArtifactRecord): string {
    const metadata = sourceArtifact.metadata || {};
    const parts = [
      sourceArtifact.source_type,
      sourceArtifact.source_uri || null,
      typeof metadata.file_name === 'string' ? metadata.file_name : null,
    ].filter(Boolean);
    return parts.join(' | ') || 'Fuente sin descripcion';
  }

  private extractDateTimeHint(sourceArtifact: MeetingSourceArtifactRecord): string | null {
    const metadata = sourceArtifact.metadata || {};
    const candidates = [metadata.created_time, metadata.imported_at, metadata.date];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
    return null;
  }

  private getObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  private normalizeStringItems(value: unknown): string[] {
    return this.limitStrings(this.asStringArray(value), 8);
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asNullableString(value: unknown): string | null {
    const nextValue = this.asString(value);
    return nextValue || null;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.asString(item))
      .filter(Boolean);
  }

  private limitStrings(values: string[], limit: number): string[] {
    return values.filter(Boolean).slice(0, limit);
  }

  private asConfidence(value: unknown, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return this.clampNumber(fallback, 0, 1);
    }
    return this.clampNumber(value, 0, 1);
  }

  private asOptionalConfidence(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    return this.clampNumber(value, 0, 1);
  }

  private clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toIsoDateOrNull(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }

  private normalizePriority(value: unknown): MeetingAnalysisTaskItem['prioritySuggested'] {
    if (typeof value !== 'string') return 'medium';
    const normalized = value.trim().toLowerCase();
    return (ALLOWED_PRIORITIES as readonly string[]).includes(normalized)
      ? normalized as MeetingAnalysisTaskItem['prioritySuggested']
      : 'medium';
  }

  private normalizeSeverity(value: unknown): MeetingAnalysisRiskItem['severity'] {
    if (typeof value !== 'string') return 'medium';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'critical') return 'critical';
    if (normalized === 'high') return 'high';
    if (normalized === 'low') return 'low';
    return 'medium';
  }

  private normalizeFollowUpType(value: unknown): MeetingAnalysisFollowUpRecommendation['type'] | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    return (ALLOWED_FOLLOW_UP_TYPES as readonly string[]).includes(normalized)
      ? normalized as MeetingAnalysisFollowUpRecommendation['type']
      : undefined;
  }

  private normalizeDestinationValue(value: unknown): MeetingAnalysisDestinationRecommendation['suggestedDestination'] | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return (ALLOWED_DESTINATIONS as readonly string[]).includes(normalized)
      ? normalized as MeetingAnalysisDestinationRecommendation['suggestedDestination']
      : null;
  }

  private normalizeMessageKind(value: unknown): MeetingAnalysisMessageDraft['kind'] | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (normalized === 'team_summary' || normalized === 'follow_up' || normalized === 'owner_confirmation' || normalized === 'other') {
      return normalized;
    }
    return null;
  }

  private inferPriority(line: string): MeetingAnalysisTaskItem['prioritySuggested'] {
    if (/critico|critical|urgente/i.test(line)) return 'critical';
    if (/alto|high|importante/i.test(line)) return 'high';
    if (/bajo|low/i.test(line)) return 'low';
    return 'medium';
  }

  private inferSeverity(line: string): MeetingAnalysisRiskItem['severity'] {
    if (/critico|critical/i.test(line)) return 'critical';
    if (/alto|high/i.test(line)) return 'high';
    if (/bajo|low/i.test(line)) return 'low';
    return 'medium';
  }
}
