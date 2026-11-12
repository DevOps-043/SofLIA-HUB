import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentActivityContext } from '../../components/agents/agent-activity-context';
import { useChatBackgroundPresence } from '../../adapters/desktop_ui/chat-ui/useChatBackgroundPresence';
import type { AgentActivity } from '../../shared/agent-activity';
import type { ReactNode } from 'react';

describe('gestos de trabajos en segundo plano', () => {
  it('exige vínculo del mensaje, reacciona a finalización y cede al siguiente turno', () => {
    const item: AgentActivity = { id: 'job', sequence: 1, surface: 'chat', kind: 'document', status: 'running', agents: [], durationMs: 0,
      execution: { id: 'job', status: 'running', title: 'Informe', conversationId: 'chat-a', messageId: 'respuesta', artifacts: [], summary: '', error: null, tokens: 0 } };
    const panel = { items: [item], error: '', open: false, runningCount: 1, setOpen() {}, toggle() {} };
    const wrapper = ({ children }: { children: ReactNode }) => <AgentActivityContext value={panel}>{children}</AgentActivityContext>;
    const messages = [{ id: 'respuesta', role: 'model' as const, text: 'Equipo trabajando', timestamp: 1 }];
    const hook = renderHook(({ conversation, version }) => useChatBackgroundPresence(messages, conversation, version), { wrapper, initialProps: { conversation: 'chat-a', version: 1 } });
    expect(hook.result.current.active).toBe(true);
    item.execution!.status = 'completed'; hook.rerender({ conversation: 'chat-a', version: 1 });
    expect(hook.result.current.outcome?.expression).toBe('success');
    hook.rerender({ conversation: 'chat-a', version: 2 }); expect(hook.result.current.outcome).toBeUndefined();
    item.execution!.status = 'failed'; hook.rerender({ conversation: 'chat-a', version: 2 });
    expect(hook.result.current.outcome?.expression).toBe('concerned');
    hook.rerender({ conversation: 'chat-b', version: 2 });
    expect(hook.result.current.active).toBe(false); expect(hook.result.current.outcome).toBeUndefined();
  });
});
