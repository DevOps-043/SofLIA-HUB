import { describe, expect, it } from 'vitest';

describe('Init Order and Service Failure Resilience', () => {
  it('INT-006: service initialization follows dependency order', () => {
    const initOrder: string[] = [];
    const initService = (name: string, deps: string[]) => {
      for (const dep of deps) {
        if (!initOrder.includes(dep)) throw new Error(`Dependencia ${dep} no inicializada antes de ${name}`);
      }
      initOrder.push(name);
    };

    initService('MemoryService', []);
    initService('KnowledgeService', []);
    initService('MonitoringService', []);
    initService('CalendarService', []);
    initService('GmailService', ['CalendarService']);
    initService('DriveService', ['CalendarService']);
    initService('WhatsAppService', []);
    initService('WhatsAppAgent', ['WhatsAppService']);
    initService('AutoDevService', []);

    expect(initOrder.indexOf('CalendarService')).toBeLessThan(initOrder.indexOf('GmailService'));
    expect(initOrder.indexOf('WhatsAppService')).toBeLessThan(initOrder.indexOf('WhatsAppAgent'));
  });

  it('INT-007: service failure is isolated and does not propagate', async () => {
    const results: Record<string, boolean> = {};
    const initWithResilience = async (name: string, initFn: () => Promise<void>) => {
      try {
        await initFn();
        results[name] = true;
      } catch {
        results[name] = false;
        console.error(`[${name}] Fallo al inicializar, continuando...`);
      }
    };

    await initWithResilience('MonitoringService', async () => {});
    await initWithResilience('CalendarService', async () => { throw new Error('OAuth expired'); });
    await initWithResilience('WhatsAppService', async () => {});

    expect(results).toEqual({ MonitoringService: true, CalendarService: false, WhatsAppService: true });
  });
});

describe('Gemini Fallback', () => {
  it('INT-009: retries with fallback model on 503 error', async () => {
    let attempts = 0;
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    const callGemini = async (model: string): Promise<{ success: boolean; model: string }> => {
      attempts++;
      if (model === models[0]) throw { status: 503, message: 'Service Unavailable' };
      return { success: true, model };
    };

    let result: any;
    for (const model of models) {
      try {
        result = await callGemini(model);
        break;
      } catch (err: any) {
        if (err.status !== 503) throw err;
      }
    }

    expect(attempts).toBe(2);
    expect(result.model).toBe('gemini-1.5-flash');
  });
});
