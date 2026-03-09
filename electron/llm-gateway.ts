import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface UsageEntry {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  timestamp: string;
}

export class LLMGateway {
  private dbPath: string = '';
  private initialized: boolean = false;

  public init() {
    if (this.initialized) return;
    try {
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'llm_usage.json');
      
      if (!fs.existsSync(this.dbPath)) {
        fs.writeFileSync(this.dbPath, JSON.stringify([]), 'utf-8');
      }
      this.initialized = true;
      console.log('[LLMGateway] Archivo de uso inicializado en:', this.dbPath);
    } catch (err) {
      console.error('[LLMGateway] Error inicializando archivo de uso:', err);
    }
  }

  private readUsage(): UsageEntry[] {
    try {
      if (!fs.existsSync(this.dbPath)) return [];
      const data = fs.readFileSync(this.dbPath, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('[LLMGateway] Error leyendo archivo de uso:', err);
      return [];
    }
  }

  private writeUsage(entries: UsageEntry[]) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (err) {
      console.error('[LLMGateway] Error escribiendo archivo de uso:', err);
    }
  }

  private appendUsage(entry: UsageEntry) {
    const entries = this.readUsage();
    entries.push(entry);
    this.writeUsage(entries);
  }

  public async routeRequest(prompt: string, model: string, apiKey: string): Promise<string> {
    if (!this.initialized) this.init();

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const generativeModel = genAI.getGenerativeModel({ model });
      const result = await generativeModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const usageMetadata = response.usageMetadata;
      let promptTokens = 0;
      let completionTokens = 0;

      if (usageMetadata) {
        promptTokens = usageMetadata.promptTokenCount || 0;
        completionTokens = usageMetadata.candidatesTokenCount || 0;
      }

      // Costo estimado basado en tarifas aproximadas de Gemini Flash 1.5/2.5
      // $0.075 por 1M de tokens prompt, $0.30 por 1M de tokens completion
      const cost = (promptTokens * 0.075 / 1000000) + (completionTokens * 0.30 / 1000000);

      if (this.initialized) {
        this.appendUsage({
          model,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          cost,
          timestamp: new Date().toISOString()
        });
      }

      return text;
    } catch (error: any) {
      console.error('[LLMGateway] Error en routeRequest:', error);
      throw error;
    }
  }

  public async getUsageReport(): Promise<string> {
    if (!this.initialized) this.init();
    if (!this.initialized) return 'El sistema de registro de uso no está inicializado.';

    try {
      const entries = this.readUsage();
      
      const now = new Date();
      const todayYear = now.getFullYear();
      const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
      const todayDay = String(now.getDate()).padStart(2, '0');
      
      const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
      const thisMonthStr = `${todayYear}-${todayMonth}`;

      let dayP = 0, dayC = 0, dayCost = 0;
      let monthP = 0, monthC = 0, monthCost = 0;

      for (const entry of entries) {
        const d = new Date(entry.timestamp);
        const eYear = d.getFullYear();
        const eMonth = String(d.getMonth() + 1).padStart(2, '0');
        const eDay = String(d.getDate()).padStart(2, '0');
        
        const entryDateStr = `${eYear}-${eMonth}-${eDay}`;
        const entryMonthStr = `${eYear}-${eMonth}`;

        if (entryDateStr === todayStr) {
          dayP += entry.prompt_tokens;
          dayC += entry.completion_tokens;
          dayCost += entry.cost;
        }

        if (entryMonthStr === thisMonthStr) {
          monthP += entry.prompt_tokens;
          monthC += entry.completion_tokens;
          monthCost += entry.cost;
        }
      }

      const formatNum = (num: number) => num.toLocaleString('es-MX');
      const formatCost = (num: number) => num.toFixed(5);

      return `📊 *Reporte de Uso de IA*\n\n*Hoy:*\n• Tokens prompt: ${formatNum(dayP)}\n• Tokens respuesta: ${formatNum(dayC)}\n• Costo estimado: ${formatCost(dayCost)} USD\n\n*Este Mes:*\n• Tokens prompt: ${formatNum(monthP)}\n• Tokens respuesta: ${formatNum(monthC)}\n• Costo estimado: ${formatCost(monthCost)} USD`;
    } catch (err: any) {
      console.error('[LLMGateway] Error generando reporte:', err);
      return `Error generando reporte: ${err.message}`;
    }
  }
}

export const llmGateway = new LLMGateway();

export const aiUsageReportTool = {
  name: 'ai_usage_report',
  description: 'Genera un reporte del uso de tokens y costo estimado de la IA consumidos por el usuario (diario y mensual).',
  parameters: {
    type: 'OBJECT',
    properties: {}
  },
  handler: async (_args: any) => {
    try {
      const report = await llmGateway.getUsageReport();
      return { success: true, data: report };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
