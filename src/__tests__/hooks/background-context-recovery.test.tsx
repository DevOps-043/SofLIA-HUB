import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useBackgroundTeams } from '../../components/agents/useBackgroundTeams';
import { backgroundTeamsService } from '../../services/background-teams';

afterEach(() => { vi.restoreAllMocks(); delete window.backgroundTeams; });
it('restaura el contexto cuando main invalida la sesión después de la carga inicial', async () => {
  let changed = () => {};
  window.backgroundTeams = { onChanged: (listener: () => void) => { changed = listener; return () => {}; } } as never;
  const state = { scope: { userId: 'usuario', dataUserId: 'datos', organizationId: null }, persistence: 'encrypted' as const, jobs: [] };
  const context = vi.spyOn(backgroundTeamsService, 'context').mockResolvedValue(state);
  vi.spyOn(backgroundTeamsService, 'state').mockRejectedValueOnce(new Error('Contexto invalidado'));
  const hook = renderHook(() => useBackgroundTeams('usuario', null));
  await waitFor(() => expect(context).toHaveBeenCalledOnce());
  await act(async () => changed());
  await waitFor(() => expect(context).toHaveBeenCalledTimes(2));
  expect(hook.result.current.error).toBe('');
});
