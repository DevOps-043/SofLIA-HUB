import { sendOpenAIMessageStream } from '../../src/services/openai-chat/send-message-stream';
import { buildSystemInstruction } from '../../src/services/gemini-chat/system-instruction';
import { getPublicAiErrorMessage } from '../../src/services/gemini-chat/public-error';
import { AUDIOVISUAL_SKILL } from '../../src/shared/skills/audiovisual-skill';
import type { ToolCallInfo } from '../../src/services/gemini-chat/types';
import { workspaceApi } from '../../src/services/skills/workspace-bridge';

declare global { interface Window { __AUDIO_EVAL__: { workspaceId: string; model: string; brief: string }; __audioEval: () => Promise<unknown>; __cancelAudioEval?: () => void; } }

/** Usa el cliente y loop reales del producto; no sustituye respuestas del modelo. */
window.__audioEval = async () => {
  const { workspaceId, model, brief } = window.__AUDIO_EVAL__;
  const controller = new AbortController(), start = performance.now();
  window.__cancelAudioEval = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), 15 * 60_000);
  const activeSkill = { ...AUDIOVISUAL_SKILL, workspaceId };
  const options = { activeSkill, browserSourceMode: 'attached-fragments' as const, signal: controller.signal };
  let calls: ToolCallInfo[] = [];
  const trace = () => calls.map(tool => {
    let ok: boolean | null = null;
    try { const result = JSON.parse(tool.result ?? '{}'); ok = typeof result.success === 'boolean' ? result.success : null; } catch { /* Resultado no estructurado. */ }
    return { name: tool.name, ok };
  });
  try {
    const response = await sendOpenAIMessageStream({ modelId: model, finalMessage: brief, conversationHistory: [], systemInstruction: buildSystemInstruction(brief, options), options, useToolLoop: true, computerUseEnabled: false, useWebSearch: false, reasoningEffort: 'high' });
    calls = response.toolCalls ?? [];
    let final = ''; for await (const part of response.stream) final += part;
    const state = await workspaceApi()?.getState(workspaceId);
    return { model, ok: state?.success === true && state.state?.ready === true, elapsedMs: Math.round(performance.now() - start), trace: trace(), final, perfilAislado: true, pipeline: 'loop OpenAI del producto + skill + IPC + producción reales' };
  } catch (error) {
    return { model, ok: false, elapsedMs: Math.round(performance.now() - start), trace: trace(), error: getPublicAiErrorMessage(error), perfilAislado: true, pipeline: 'loop OpenAI del producto + skill + IPC + producción reales' };
  } finally { clearTimeout(timer); }
};
