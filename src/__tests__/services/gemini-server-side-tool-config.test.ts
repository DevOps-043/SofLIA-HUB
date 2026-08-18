import { describe, expect, it } from 'vitest';
import { buildServerSideToolInvocationsConfig } from '../../shared/gemini-grounding-config';

const FUNCTION_CALLING = { functionDeclarations: [{ name: 'read_file' }] };
const CODE_EXECUTION = { codeExecution: {} };
const GOOGLE_SEARCH = { googleSearch: {} };

describe('buildServerSideToolInvocationsConfig', () => {
  it('exige la config cuando se mezcla ejecucion de codigo con function calling', () => {
    // Sin esto la API responde 400 "Please enable
    // tool_config.include_server_side_tool_invocations".
    expect(buildServerSideToolInvocationsConfig([FUNCTION_CALLING, CODE_EXECUTION]))
      .toEqual({ includeServerSideToolInvocations: true });
  });

  it('exige la config tambien con busqueda integrada mas function calling', () => {
    expect(buildServerSideToolInvocationsConfig([FUNCTION_CALLING, GOOGLE_SEARCH]))
      .toEqual({ includeServerSideToolInvocations: true });
  });

  it('no la exige con function calling solo', () => {
    expect(buildServerSideToolInvocationsConfig([FUNCTION_CALLING])).toBeUndefined();
  });

  it('no la exige con una tool integrada sola', () => {
    expect(buildServerSideToolInvocationsConfig([CODE_EXECUTION])).toBeUndefined();
  });

  it('no la exige sin tools', () => {
    expect(buildServerSideToolInvocationsConfig([])).toBeUndefined();
    expect(buildServerSideToolInvocationsConfig(undefined)).toBeUndefined();
  });

  it('ignora entradas nulas sin romper', () => {
    expect(buildServerSideToolInvocationsConfig([null, undefined, FUNCTION_CALLING, CODE_EXECUTION]))
      .toEqual({ includeServerSideToolInvocations: true });
  });
});
