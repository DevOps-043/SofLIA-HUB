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
} from './meeting-types';
import {
  DEFAULT_BLOCKED_ACTIONS,
  EXTRACTION_MODEL,
  LOW_CONFIDENCE_TASK_STATE_THRESHOLD,
} from './meeting-ai/constants';
import type {
  ExtractMeetingAssetInput,
  ExtractMeetingAssetResult,
  LegacySignal,
} from './meeting-ai/internal-types';
import {
  asConfidence,
  asNullableString,
  asOptionalConfidence,
  asString,
  asStringArray,
  clampNumber,
  getObject,
  inferPriority,
  inferSeverity,
  limitStrings,
  normalizeDestinationValue,
  normalizeFollowUpType,
  normalizeMessageKind,
  normalizePriority,
  normalizeSeverity,
  normalizeStringItems,
  normalizeText,
  parseJson,
  toIsoDateOrNull,
} from './meeting-ai/value-helpers';
import {
  buildExecutiveSummary,
  extractDueDate,
  extractOwnerCandidate,
  extractParticipants,
  getLines,
  getMeetingTypeDefinition,
  inferTitle,
  stripLabel,
} from './meeting-ai/text-helpers';
import { buildClassificationPrompt, buildExtractionPrompt } from './meeting-ai/prompts';

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
      const classificationPrompt = buildClassificationPrompt(input, contextPack);
      const classificationResult = await model.generateContent(classificationPrompt);
      const classification = parseJson<{
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

      const resolvedConfidence = clampNumber(
        typeof classification?.confidence === 'number' ? classification.confidence : 0.4,
        0.05, 0.97,
      );
      if (resolvedConfidence < contextPack.fallbackThreshold) {
        resolvedType = 'fallback_general_operational';
      }

      const typeDefinition = getMeetingTypeDefinition(contextPack, resolvedType)
        || getMeetingTypeDefinition(contextPack, 'fallback_general_operational')!;

      console.log(`[MeetingAIService] Fase 1 completa: tipo=${resolvedType}, confianza=${resolvedConfidence.toFixed(2)}`);

      // Fase 2: Extraer con prompt unico para este tipo
      const extractionPrompt = buildExtractionPrompt(
        input, contextPack, typeDefinition, resolvedType, resolvedConfidence,
        classification?.reason || '',
        classification?.relevantSignals || [],
        classification?.alternativeTypes || [],
        classification?.detectedContext || {},
      );
      const extractionResult = await model.generateContent(extractionPrompt);
      const extraction = parseJson<unknown>(extractionResult.response.text());

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
    const rawMeetingType = getObject(rawObject.meetingType);
    let suggestedType = asString(rawMeetingType?.suggestedType) || fallback.meetingType.suggestedType;
    if (!allowedTypes.has(suggestedType)) {
      suggestedType = fallback.meetingType.suggestedType;
    }

    const typeConfidence = asConfidence(rawMeetingType?.confidence, fallback.meetingType.confidence);
    if (typeConfidence < contextPack.fallbackThreshold) {
      suggestedType = 'fallback_general_operational';
    }

    const typeDefinition = getMeetingTypeDefinition(contextPack, suggestedType)
      || getMeetingTypeDefinition(contextPack, 'fallback_general_operational');
    const detectedContext = getObject(rawObject.detectedContext);
    const analysisStrategy = getObject(rawObject.analysisStrategy);
    const relevantSignals = limitStrings(asStringArray(detectedContext?.relevantSignals), 8);
    const meetingObjective = limitStrings(asStringArray(detectedContext?.meetingObjective), 6);
    const reason = asString(rawMeetingType?.reason)
      || this.buildMeetingTypeReason(typeDefinition, relevantSignals, typeConfidence, fallback.meetingType.reason);

    const normalized: MeetingAnalysisResult = {
      meetingType: {
        suggestedType,
        alternativeTypes: this.normalizeAlternativeTypes(rawMeetingType?.alternativeTypes, fallback, allowedTypes),
        confidence: typeConfidence,
        reason,
      },
      detectedContext: {
        project: asNullableString(detectedContext?.project),
        team: asNullableString(detectedContext?.team),
        meetingObjective: meetingObjective.length > 0 ? meetingObjective : fallback.detectedContext.meetingObjective,
        relevantSignals: relevantSignals.length > 0 ? relevantSignals : fallback.detectedContext.relevantSignals,
      },
      analysisStrategy: {
        strategyId: asString(analysisStrategy?.strategyId) || suggestedType,
        strategyName: asString(analysisStrategy?.strategyName)
          || typeDefinition?.displayName
          || fallback.analysisStrategy.strategyName,
        whyThisStrategy: asString(analysisStrategy?.whyThisStrategy)
          || this.buildStrategyReason(typeDefinition, relevantSignals, reason),
        extractionFocus: limitStrings(asStringArray(analysisStrategy?.extractionFocus), 8),
      },
      executiveSummary: asString(rawObject.executiveSummary) || fallback.executiveSummary,
      keyPoints: normalizeStringItems(rawObject.keyPoints),
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
    const lines = getLines(input.sourceArtifact.normalized_text);
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
      executiveSummary: buildExecutiveSummary(lines, tasks.length, decisions.length, risks.length),
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
    const title = normalizeText(input.meetingTitle || '');
    const body = normalizeText(input.sourceArtifact.normalized_text);
    const hint = normalizeText(input.meetingType);
    const candidates = contextPack.meetingTypes
      .filter((meetingType) => meetingType.id !== 'fallback_general_operational')
      .map((meetingType) => {
        const titleMatches = meetingType.titleKeywords.filter((keyword) => title.includes(normalizeText(keyword)));
        const languageMatches = meetingType.languagePatterns.filter((pattern) => body.includes(normalizeText(pattern)));
        const structuralMatches = meetingType.structuralSignals.filter((signal) => body.includes(normalizeText(signal)));
        const negativeMatches = meetingType.negativeSignals.filter((signal) => body.includes(normalizeText(signal)));
        const hintMatch = hint && [meetingType.id, meetingType.displayName].some((token) => hint.includes(normalizeText(token)));

        const score = 0.18 * Math.min(titleMatches.length, 2)
          + 0.07 * Math.min(languageMatches.length, 4)
          + 0.06 * Math.min(structuralMatches.length, 3)
          + (hintMatch ? 0.08 : 0)
          - 0.1 * Math.min(negativeMatches.length, 2);

        const confidence = clampNumber((score > 0 ? 0.18 : 0.08) + score, 0.05, 0.97);
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

    const fallbackDefinition = getMeetingTypeDefinition(contextPack, 'fallback_general_operational');
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
    const lines = getLines(input.sourceArtifact.normalized_text);
    const sourceArtifactId = input.sourceArtifact.id;
    const participants = extractParticipants(lines);
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
      meeting_title: input.meetingTitle || inferTitle(lines) || 'Reunion sin titulo',
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
      due_date_candidate: toIsoDateOrNull(task.dueDateSuggested),
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
        const source = getObject(item);
        return {
          type: asString(source?.type),
          confidence: asConfidence(source?.confidence, 0.4),
          reason: asString(source?.reason) || 'Tipo alternativo sugerido por senales parciales.',
        };
      })
      .filter((item) => item.type && allowedTypes.has(item.type));

    return normalized.length > 0 ? normalized.slice(0, 3) : fallback.meetingType.alternativeTypes;
  }

  private normalizeDecisions(raw: unknown): MeetingAnalysisResult['decisions'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = getObject(item);
        return {
          description: asString(source?.description),
          confidence: asConfidence(source?.confidence, 0.65),
          evidence: limitStrings(asStringArray(source?.evidence), 4),
        };
      })
      .filter((item) => item.description);
  }

  private normalizeAgreements(raw: unknown): MeetingAnalysisResult['agreements'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = getObject(item);
        return {
          description: asString(source?.description),
          confidence: asConfidence(source?.confidence, 0.65),
          evidence: limitStrings(asStringArray(source?.evidence), 4),
        };
      })
      .filter((item) => item.description);
  }

  private normalizeTasks(raw: unknown): MeetingAnalysisResult['tasks'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = getObject(item);
        return {
          description: asString(source?.description),
          ownerSuggested: asNullableString(source?.ownerSuggested),
          ownerConfidence: asOptionalConfidence(source?.ownerConfidence),
          dueDateSuggested: toIsoDateOrNull(asNullableString(source?.dueDateSuggested)),
          prioritySuggested: normalizePriority(source?.prioritySuggested),
          reason: asString(source?.reason) || 'Tarea sugerida con base en el contenido de la reunion.',
          confidence: asConfidence(source?.confidence, 0.68),
          requiresHumanReview: true,
          evidence: limitStrings(asStringArray(source?.evidence), 4),
        };
      })
      .filter((task) => task.description);
  }

  private normalizeRisks(raw: unknown): MeetingAnalysisResult['risks'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = getObject(item);
        return {
          description: asString(source?.description),
          severity: normalizeSeverity(source?.severity),
          confidence: asConfidence(source?.confidence, 0.65),
          reason: asString(source?.reason) || undefined,
        };
      })
      .filter((risk) => risk.description);
  }

  private normalizeOpenQuestions(raw: unknown): MeetingAnalysisResult['openQuestions'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = getObject(item);
        return {
          question: asString(source?.question),
          confidence: asConfidence(source?.confidence, 0.6),
        };
      })
      .filter((question) => question.question);
  }

  private normalizeUnresolvedItems(raw: unknown): MeetingAnalysisResult['unresolvedItems'] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = getObject(item);
        return {
          item: asString(source?.item),
          reasonOpen: asString(source?.reasonOpen) || 'Pendiente de definicion o cierre.',
          confidence: asConfidence(source?.confidence, 0.6),
        };
      })
      .filter((item) => item.item);
  }

  private normalizeFollowUp(
    raw: unknown,
    fallback: MeetingAnalysisFollowUpRecommendation,
  ): MeetingAnalysisFollowUpRecommendation {
    const source = getObject(raw);
    const suggested = typeof source?.suggested === 'boolean' ? source.suggested : fallback.suggested;
    const type = normalizeFollowUpType(source?.type);
    return {
      suggested,
      type: suggested ? (type || fallback.type || 'validation') : undefined,
      description: suggested ? (asString(source?.description) || fallback.description) : undefined,
      confidence: asConfidence(source?.confidence, fallback.confidence),
      reason: asString(source?.reason) || fallback.reason,
    };
  }

  private normalizeDestination(
    raw: unknown,
    fallback: MeetingAnalysisDestinationRecommendation,
  ): MeetingAnalysisDestinationRecommendation {
    const source = getObject(raw);
    const suggestedDestination = normalizeDestinationValue(source?.suggestedDestination) || fallback.suggestedDestination;
    return {
      suggestedDestination,
      confidence: asConfidence(source?.confidence, fallback.confidence),
      reason: asString(source?.reason) || fallback.reason,
    };
  }

  private normalizeMessageDrafts(raw: unknown): MeetingAnalysisMessageDraft[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const source = getObject(item);
        return {
          kind: normalizeMessageKind(source?.kind),
          content: asString(source?.content),
          requiresApproval: true,
        };
      })
      .filter((draft): draft is MeetingAnalysisMessageDraft => Boolean(draft.kind && draft.content))
      .slice(0, 3);
  }

  private normalizeGovernance(raw: unknown): MeetingAnalysisResult['governance'] {
    const source = getObject(raw);
    return {
      autonomyLevelApplied: clampNumber(
        typeof source?.autonomyLevelApplied === 'number' ? source.autonomyLevelApplied : 2,
        0,
        2,
      ),
      sensitiveActionsBlocked: limitStrings(asStringArray(source?.sensitiveActionsBlocked), 8),
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
        const ownerSuggested = extractOwnerCandidate(line);
        const dueDateSuggested = extractDueDate(line);
        return {
          description: stripLabel(line.replace(/^\[\s?\]\s+/, '')),
          ownerSuggested,
          ownerConfidence: ownerSuggested ? 0.7 : undefined,
          dueDateSuggested,
          prioritySuggested: inferPriority(line),
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
        description: stripLabel(line),
        severity: inferSeverity(line),
        confidence: /critico|critical|alto/i.test(line) ? 0.82 : 0.7,
        reason: line,
      }));
  }

  private extractOpenQuestionSignals(lines: string[]): MeetingAnalysisResult['openQuestions'] {
    return lines
      .filter((line) => /^(?:[-*]\s*)?(pregunta|question|duda)\b/i.test(line))
      .map((line) => ({
        question: stripLabel(line),
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
        item: stripLabel(line),
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

    const meetingType = getMeetingTypeDefinition(contextPack, suggestedType);
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
        value: stripLabel(line),
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

}
