import { MeetingContextPackLoader } from './meeting-context-pack';
import type {
  ExtractMeetingAssetInput,
  ExtractMeetingAssetResult,
} from './meeting-ai/internal-types';
import { buildMeetingAssetPayload } from './meeting-ai/asset-payload-builder';
import { tryExtractMeetingWithAI } from './meeting-ai/extraction-runtime';
import { normalizeMeetingAnalysisResult } from './meeting-ai/analysis-normalizer';

export class MeetingAIService {
  private readonly contextPackLoader = new MeetingContextPackLoader();

  async extractMeetingAsset(input: ExtractMeetingAssetInput): Promise<ExtractMeetingAssetResult> {
    const contextPack = await this.contextPackLoader.load();
    const normalizedAnalysis = normalizeMeetingAnalysisResult(
      await tryExtractMeetingWithAI({
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

}
