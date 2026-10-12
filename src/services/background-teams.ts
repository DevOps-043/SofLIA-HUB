import type { BackgroundJob, BackgroundStart, BackgroundTeamsBridge } from '../shared/background-teams';
declare global { interface Window { backgroundTeams?: BackgroundTeamsBridge } }
function bridge(): BackgroundTeamsBridge {
  if (!window.backgroundTeams) throw new Error('Los equipos ejecutores necesitan PulseHub de escritorio.');
  return window.backgroundTeams;
}
export const backgroundTeamsService = {
  async attachLegacy(input: { jobId: string; messageId: string; conversationId: string }): Promise<void> {
    const reply = await bridge().attachLegacy(input);
    if (!reply.success) throw new Error(reply.error);
  },
  async context(organizationId: string | null) {
    const result = await bridge().context({ organizationId });
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  async state() {
    const result = await bridge().state();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  async start(input: Omit<BackgroundStart, 'expectedOwnerId' | 'expectedOrganizationId'>, organizationId: string | null): Promise<BackgroundJob> {
    const state = await this.context(organizationId);
    const result = await bridge().start({ ...input, expectedOwnerId: state.scope.userId, expectedOrganizationId: state.scope.organizationId });
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  async control(jobId: string, action: 'pause' | 'resume' | 'cancel'): Promise<void> {
    const result = await bridge().control({ jobId, action });
    if (!result.success) throw new Error(result.error);
  },
  async open(jobId: string, artifactId: string): Promise<void> {
    const result = await bridge().open({ jobId, artifactId });
    if (!result.success) throw new Error(result.error);
  },
};

