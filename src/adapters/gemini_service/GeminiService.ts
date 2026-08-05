import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { AIAssistant } from '../../core/ports/AIAssistant';
import { SOFLIA_RUNTIME_MODEL } from '../../shared/soflia-runtime-model';

export class GeminiService implements AIAssistant {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: SOFLIA_RUNTIME_MODEL });
  }

  async sendMessage(message: string, _context?: any): Promise<string> {
    try {
      // For now, simple text-only generation.
      // Context can be used to construct system instructions or chat history later.
      const result = await this.model.generateContent(message);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw error;
    }
  }
}
