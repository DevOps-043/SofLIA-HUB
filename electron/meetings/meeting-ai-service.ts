import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
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

type PartialMeetingAssetPayload = Omit<
  MeetingAssetPayload,
  'schema_version' | 'meeting_run_id' | 'trace_id' | 'source_refs' | 'review_flags' | 'proposed_actions'
>;

const EXTRACTION_MODEL = 'gemini-2.5-flash';

export class MeetingAIService {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;

  setApiKey(apiKey: string | null): void {
    this.apiKey = apiKey?.trim() || null;
    this.genAI = null;
  }

  async extractMeetingAsset(input: ExtractMeetingAssetInput): Promise<ExtractMeetingAssetResult> {
    const aiPayload = await this.tryExtractWithAI(input);
    const payload = this.withEnvelope(aiPayload ?? this.extractFallback(input), input);
    return {
      payload,
      confidence: aiPayload ? 0.82 : 0.45,
    };
  }

  private async tryExtractWithAI(input: ExtractMeetingAssetInput): Promise<PartialMeetingAssetPayload | null> {
    if (!this.apiKey) return null;

    try {
      if (!this.genAI) {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
      }

      const model = this.genAI.getGenerativeModel({
        model: EXTRACTION_MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const prompt = `
Eres un extractor de reuniones. Devuelve SOLO JSON valido.

Extrae estos campos:
- meeting_title
- meeting_type
- participants[]
- decisions[]
- commitments[]
- issues[]
- open_questions[]
- parking_lot[]
- executive_summary
- operational_summary
- continuity_context[]

Reglas:
- No inventes datos.
- Si falta algo, deja arreglos vacios o null.
- commitments debe incluir owner_candidate, due_date_candidate y status si aparecen.
- Usa status "open" cuando el compromiso exista y no haya mejor estado.
- Para evidence_refs usa un arreglo vacio.

Formato:
{
  "meeting_title": "string",
  "meeting_type": "string",
  "participants": [{ "display_name": "string", "email": "string|null", "external": false, "confidence": 0.9 }],
  "decisions": [{ "statement": "string", "owner_candidate": "string|null", "approval_state": "needs_review", "evidence_refs": [], "confidence": 0.8 }],
  "commitments": [{ "statement": "string", "owner_candidate": "string|null", "due_date_candidate": "YYYY-MM-DD|null", "status": "open", "project_target": "string|null", "evidence_refs": [], "confidence": 0.8 }],
  "issues": [{ "statement": "string", "severity": "medium", "owner_candidate": "string|null", "evidence_refs": [], "confidence": 0.7 }],
  "open_questions": [{ "question": "string", "owner_candidate": "string|null", "evidence_refs": [] }],
  "parking_lot": [{ "statement": "string", "evidence_refs": [] }],
  "executive_summary": "string",
  "operational_summary": "string",
  "continuity_context": ["string"]
}

Titulo sugerido: ${input.meetingTitle || 'Reunion sin titulo'}
Tipo sugerido: ${input.meetingType}

Texto fuente:
"""${input.sourceArtifact.normalized_text.slice(0, 16000)}"""
`.trim();

      const result = await model.generateContent(prompt);
      const parsed = this.parseJson<PartialMeetingAssetPayload>(result.response.text());
      return this.coercePartialPayload(parsed);
    } catch (error) {
      console.warn('[MeetingAIService] AI extraction failed, using fallback:', error);
      return null;
    }
  }

  private extractFallback(input: ExtractMeetingAssetInput): PartialMeetingAssetPayload {
    const lines = input.sourceArtifact.normalized_text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const participants = this.extractParticipants(lines);
    const decisions = this.extractDecisionLikeItems(lines, ['decision', 'decisiones', 'acuerdo']);
    const commitments = this.extractCommitments(lines);
    const issues = this.extractIssues(lines);
    const openQuestions = this.extractOpenQuestions(lines);
    const parkingLot = this.extractParkingLot(lines);

    const executiveSummary = this.buildExecutiveSummary(lines, commitments.length, decisions.length, issues.length);
    const operationalSummary = this.buildOperationalSummary(input.meetingTitle, participants.length, commitments.length, issues.length);

    return {
      meeting_title: input.meetingTitle || this.inferTitle(lines) || 'Reunion sin titulo',
      meeting_type: input.meetingType,
      participants,
      decisions,
      commitments,
      issues,
      open_questions: openQuestions,
      parking_lot: parkingLot,
      executive_summary: executiveSummary,
      operational_summary: operationalSummary,
      continuity_context: this.buildContinuityContext(commitments, issues),
    };
  }

  private withEnvelope(payload: PartialMeetingAssetPayload, input: ExtractMeetingAssetInput): MeetingAssetPayload {
    const sourceArtifactId = input.sourceArtifact.id;
    return {
      schema_version: 'meeting_asset.v1',
      meeting_run_id: input.meetingRunId,
      trace_id: input.traceId,
      meeting_title: payload.meeting_title || input.meetingTitle || 'Reunion sin titulo',
      meeting_type: payload.meeting_type || input.meetingType || 'general',
      source_refs: [{
        source_artifact_id: sourceArtifactId,
        source_type: input.sourceArtifact.source_type,
        source_uri: input.sourceArtifact.source_uri,
      }],
      participants: payload.participants || [],
      decisions: this.attachEvidence(payload.decisions || [], [{ source_artifact_id: sourceArtifactId }]),
      commitments: this.attachEvidence(payload.commitments || [], [{ source_artifact_id: sourceArtifactId }]),
      issues: this.attachEvidence(payload.issues || [], [{ source_artifact_id: sourceArtifactId }]),
      open_questions: this.attachEvidence(payload.open_questions || [], [{ source_artifact_id: sourceArtifactId }]),
      parking_lot: this.attachEvidence(payload.parking_lot || [], [{ source_artifact_id: sourceArtifactId }]),
      executive_summary: payload.executive_summary || 'Se importo la reunion, pero el resumen necesita revision manual.',
      operational_summary: payload.operational_summary || 'No se pudo construir un resumen operativo completo.',
      review_flags: [],
      proposed_actions: [],
      continuity_context: Array.isArray(payload.continuity_context) ? payload.continuity_context.filter(Boolean) : [],
    };
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

  private extractDecisionLikeItems(lines: string[], labels: string[]): MeetingDecision[] {
    return lines
      .filter((line) => labels.some((label) => new RegExp(`^(?:[-*]\\s*)?${label}\\b`, 'i').test(line)))
      .map((line) => ({
        statement: this.stripLabel(line),
        owner_candidate: this.extractOwnerCandidate(line),
        approval_state: 'needs_review' as const,
        evidence_refs: [],
        confidence: 0.68,
      }));
  }

  private extractCommitments(lines: string[]): MeetingCommitment[] {
    return lines
      .filter((line) => /^(?:[-*]\s*)?(accion|acci\u00f3n|tarea|compromiso|todo)\b/i.test(line) || /^\[\s?\]\s+/.test(line))
      .map((line) => ({
        statement: this.stripLabel(line.replace(/^\[\s?\]\s+/, '')),
        owner_candidate: this.extractOwnerCandidate(line),
        due_date_candidate: this.extractDueDate(line),
        status: this.extractCommitmentStatus(line),
        project_target: this.extractProjectTarget(line),
        evidence_refs: [],
        confidence: 0.72,
      }));
  }

  private extractIssues(lines: string[]): MeetingIssue[] {
    return lines
      .filter((line) => /^(?:[-*]\s*)?(bloqueo|blocker|riesgo|issue|problema)\b/i.test(line))
      .map((line) => ({
        statement: this.stripLabel(line),
        severity: /alto|critico|critical/i.test(line) ? 'high' : /medio|medium/i.test(line) ? 'medium' : 'low',
        owner_candidate: this.extractOwnerCandidate(line),
        evidence_refs: [],
        confidence: 0.69,
      }));
  }

  private extractOpenQuestions(lines: string[]): MeetingOpenQuestion[] {
    return lines
      .filter((line) => /^(?:[-*]\s*)?(pregunta|question|duda)\b/i.test(line))
      .map((line) => ({
        question: this.stripLabel(line),
        owner_candidate: this.extractOwnerCandidate(line),
        evidence_refs: [],
      }));
  }

  private extractParkingLot(lines: string[]): MeetingParkingLotItem[] {
    return lines
      .filter((line) => /^(?:[-*]\s*)?(parking|tema pendiente|backlog)\b/i.test(line))
      .map((line) => ({
        statement: this.stripLabel(line),
        evidence_refs: [],
      }));
  }

  private inferTitle(lines: string[]): string | null {
    const firstLine = lines.find((line) => line.length > 8);
    return firstLine ? firstLine.slice(0, 120) : null;
  }

  private buildExecutiveSummary(lines: string[], commitments: number, decisions: number, issues: number): string {
    const seed = lines.slice(0, 3).join(' ');
    return [
      seed ? seed.slice(0, 240) : 'Reunion importada para revision.',
      `Compromisos detectados: ${commitments}.`,
      `Decisiones detectadas: ${decisions}.`,
      issues > 0 ? `Bloqueos o riesgos detectados: ${issues}.` : null,
    ].filter(Boolean).join(' ');
  }

  private buildOperationalSummary(
    meetingTitle: string | null,
    participants: number,
    commitments: number,
    issues: number,
  ): string {
    return [
      `Reunion: ${meetingTitle || 'Sin titulo'}.`,
      `Participantes detectados: ${participants}.`,
      `Compromisos detectados: ${commitments}.`,
      `Issues detectados: ${issues}.`,
    ].join(' ');
  }

  private buildContinuityContext(commitments: MeetingCommitment[], issues: MeetingIssue[]): string[] {
    const context: string[] = [];
    for (const commitment of commitments.slice(0, 5)) {
      context.push(`Seguimiento pendiente: ${commitment.statement}`);
    }
    for (const issue of issues.slice(0, 3)) {
      context.push(`Bloqueo abierto: ${issue.statement}`);
    }
    return context;
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

  private extractProjectTarget(line: string): string | null {
    const match = line.match(/(?:project|proyecto)\s*[:=-]\s*([A-Za-z0-9 _-]+)/i);
    return match?.[1]?.trim() || null;
  }

  private extractCommitmentStatus(line: MeetingCommitment['statement']): MeetingCommitment['status'] {
    if (/bloquead|blocked/i.test(line)) return 'blocked';
    if (/riesgo|at risk/i.test(line)) return 'at_risk';
    if (/resuelto|done|complete/i.test(line)) return 'resolved';
    return 'open';
  }

  private stripLabel(line: string): string {
    return line
      .replace(/^(?:[-*]\s*)?(\[\s?\]\s*)?([A-Za-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1 ]+)\s*:\s*/i, '')
      .trim();
  }

  private parseJson<T>(rawText: string): T {
    const normalized = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/, '');
    return JSON.parse(normalized) as T;
  }

  private coercePartialPayload(payload: PartialMeetingAssetPayload): PartialMeetingAssetPayload {
    return {
      meeting_title: payload.meeting_title,
      meeting_type: payload.meeting_type,
      participants: Array.isArray(payload.participants) ? payload.participants : [],
      decisions: Array.isArray(payload.decisions) ? payload.decisions : [],
      commitments: Array.isArray(payload.commitments) ? payload.commitments : [],
      issues: Array.isArray(payload.issues) ? payload.issues : [],
      open_questions: Array.isArray(payload.open_questions) ? payload.open_questions : [],
      parking_lot: Array.isArray(payload.parking_lot) ? payload.parking_lot : [],
      executive_summary: payload.executive_summary || '',
      operational_summary: payload.operational_summary || '',
      continuity_context: Array.isArray(payload.continuity_context) ? payload.continuity_context : [],
    };
  }
}
