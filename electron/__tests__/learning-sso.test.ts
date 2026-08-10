import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shell } from 'electron';
import { buildLearningSsoUrl, openLearningSso } from '../learning-sso';

const VALID_STATE = 'a'.repeat(22);
const VALID_CHALLENGE = 'b'.repeat(43);

function envWith(baseUrl: string): NodeJS.ProcessEnv {
  return { VITE_LEARNING_BASE_URL: baseUrl } as unknown as NodeJS.ProcessEnv;
}

describe('learning-sso', () => {
  beforeEach(() => {
    vi.mocked(shell.openExternal).mockClear();
  });

  it('builds the start url from configuration', () => {
    const url = buildLearningSsoUrl(
      { codeChallenge: VALID_CHALLENGE, state: VALID_STATE },
      envWith('https://soflia.ai'),
    );

    expect(url).toBe(
      `https://soflia.ai/api/auth/desktop/start?state=${VALID_STATE}&code_challenge=${VALID_CHALLENGE}`,
    );
  });

  it('ignores a trailing slash in the configured base url', () => {
    const url = buildLearningSsoUrl(
      { codeChallenge: VALID_CHALLENGE, state: VALID_STATE },
      envWith('https://soflia.ai/'),
    );

    expect(url).toContain('https://soflia.ai/api/auth/desktop/start');
  });

  it('returns null when the base url is not configured', () => {
    expect(
      buildLearningSsoUrl({ codeChallenge: VALID_CHALLENGE, state: VALID_STATE }, envWith('')),
    ).toBeNull();
  });

  it('rejects non https origins outside localhost', () => {
    expect(
      buildLearningSsoUrl(
        { codeChallenge: VALID_CHALLENGE, state: VALID_STATE },
        envWith('http://learning.ejemplo.com'),
      ),
    ).toBeNull();
  });

  it('allows plain http only on loopback for local development', () => {
    expect(
      buildLearningSsoUrl(
        { codeChallenge: VALID_CHALLENGE, state: VALID_STATE },
        envWith('http://localhost:3000'),
      ),
    ).toContain('http://localhost:3000/api/auth/desktop/start');
  });

  it('rejects malformed state and challenge', () => {
    const env = envWith('https://soflia.ai');

    expect(buildLearningSsoUrl({ codeChallenge: VALID_CHALLENGE, state: 'corto' }, env)).toBeNull();
    expect(buildLearningSsoUrl({ codeChallenge: 'corto', state: VALID_STATE }, env)).toBeNull();
    expect(
      buildLearningSsoUrl(
        { codeChallenge: VALID_CHALLENGE, state: `${'a'.repeat(20)}/../otro` },
        env,
      ),
    ).toBeNull();
  });

  it('does not open the browser when the input is rejected', async () => {
    const result = await openLearningSso(
      { codeChallenge: 'corto', state: VALID_STATE },
      envWith('https://soflia.ai'),
    );

    expect(result.success).toBe(false);
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('opens the system browser with the built url', async () => {
    const result = await openLearningSso(
      { codeChallenge: VALID_CHALLENGE, state: VALID_STATE },
      envWith('https://soflia.ai'),
    );

    expect(result.success).toBe(true);
    expect(shell.openExternal).toHaveBeenCalledWith(
      `https://soflia.ai/api/auth/desktop/start?state=${VALID_STATE}&code_challenge=${VALID_CHALLENGE}`,
    );
  });
});
