import { GoogleGenerativeAI } from '@google/generative-ai';
import { MeetingContextPackLoader } from './meeting-context-pack';
import type {
  ExtractMeetingAssetInput,
  ExtractMeetingAssetResult,
} from './meeting-ai/internal-types';
import { buildMeetingAssetPayload } from './meeting-ai/asset-payload-builder';
import { tryExtractMeetingWithAI } from './meeting-ai/extraction-runtime';
import { normalizeMeetingAnalysisResult } from './meeting-ai/analysis-normalizer';

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
    const normalizedAnalysis = normalizeMeetingAnalysisResult(
      await tryExtractMeetingWithAI({
        ai: this.getAIClient(),
        input,
        contextPack,
      }),
      input,
      contextPack,
    );
    return {
      payload: buildMeetingAssetPayload(normalizedAnalysis, input),
      confidence: normalizedAnalysis.meetingType.confidence,
    };
  }

  private getAIClient(): GoogleGenerativeAI | null {
    if (!this.apiKey) return null;
    if (!this.genAI) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
    return this.genAI;
  }
}
