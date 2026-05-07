/**
 * Tipos internos del servicio de extracción AI de reuniones.
 *
 * Aislados aquí para que el archivo principal `meeting-ai-service.ts` quede
 * focalizado en la lógica de extracción, no en definiciones de contratos.
 */

import type { MeetingAssetPayload, MeetingSourceArtifactRecord } from '../meeting-types';

export interface ExtractMeetingAssetInput {
  traceId: string;
  meetingRunId: string;
  meetingTitle: string | null;
  meetingType: string;
  sourceArtifact: MeetingSourceArtifactRecord;
}

export interface ExtractMeetingAssetResult {
  payload: MeetingAssetPayload;
  confidence: number | null;
}

/**
 * Señal extraída por los parsers legacy basados en regex.
 * Usado como fallback cuando el LLM falla o no está disponible.
 */
export interface LegacySignal {
  value: string;
  evidence: string[];
  confidence: number;
}
