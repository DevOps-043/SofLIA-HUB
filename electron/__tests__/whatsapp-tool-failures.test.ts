import { beforeEach, expect, it, vi } from 'vitest';
import { unexpectedToolFailure } from '../wa-executor/unexpected-failure';
const logger = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../utils/logger', () => ({ createLogger: () => logger }));
beforeEach(() => vi.clearAllMocks());
it.each(['guard', 'execution'] as const)('correlaciona un fallo %s sin payload ni nombre inválido en logs', phase => {
  const name = 'correo-privado@example.test';
  const result = unexpectedToolFailure(name, phase);
  expect(result.functionResponse.name).toBe(name);
  expect(result.functionResponse.response).toMatchObject({ success: false,
    correlationId: expect.stringMatching(/^[a-f0-9-]{36}$/), errorCode: phase === 'guard' ? 'TOOL_GUARD_FAILED' : 'TOOL_EXECUTION_FAILED' });
  expect(logger.warn.mock.calls[0][0]).toMatchObject({ correlationId: result.functionResponse.response.correlationId, tool: 'herramienta_desconocida' });
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(name);
  expect(Object.keys(logger.warn.mock.calls[0][0])).toEqual(['correlationId', 'errorCode', 'tool']);
  if (phase === 'execution') expect(result.functionResponse.response).toMatchObject({ uncertain: true, recoveryRequired: true });
  else expect(result.functionResponse.response).not.toHaveProperty('uncertain');
});
