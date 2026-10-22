import { describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { registerMeetingHandlers } from '../meeting-handlers';
import type { MeetingWorkflowService } from '../meetings/meeting-workflow-service';
import { CHANNEL_GROUP_4 } from '../preload/channel-group-4';
import { CHANNEL_GROUP_5 } from '../preload/channel-group-5';
import { WA_TOOL_DECLARATIONS } from '../wa-tools';
import { ECOSYSTEM_APPS } from '../../src/shared/browser-ecosystem';
import { MeetingReviewService } from '../meetings/meeting-review-service';
import { createRunDetailFixture } from './whatsapp-workflow-meetings.fixture';

const harness = ipcMain as unknown as {
  _clearHandlers: () => void;
  _getHandlers: () => Map<string, (...args: unknown[]) => Promise<unknown>>;
};

describe('retirada de Project Hub con conservación de reuniones', () => {
  it('no publica canales o herramientas de Project Hub en las superficies runtime', () => {
    const channels = [...CHANNEL_GROUP_4, ...CHANNEL_GROUP_5];
    expect(channels.filter(channel => channel.startsWith('project-hub:'))).toEqual([]);
    expect(channels).not.toContain('meeting:get-context');
    expect(channels).not.toContain('meeting:sync-approved-actions');
    expect(WA_TOOL_DECLARATIONS.functionDeclarations.filter(tool => tool.name.startsWith('iris_'))).toEqual([]);
    expect(ECOSYSTEM_APPS.map(app => app.url)).not.toContain('https://sofliahub.netlify.app/');
  });

  it('registra y ejecuta aprobación local sin registrar sincronización o contexto externo', async () => {
    harness._clearHandlers();
    const detail = createRunDetailFixture();
    const approveAsset = vi.fn(async () => detail);
    registerMeetingHandlers({ approveAsset } as unknown as MeetingWorkflowService);
    const handlers = harness._getHandlers();
    expect(handlers.has('meeting:sync-approved-actions')).toBe(false);
    expect(handlers.has('meeting:get-context')).toBe(false);
    const approve = handlers.get('meeting:approve-asset')!;
    expect(await approve({}, { runId: detail.run.id, decidedByUserId: 'usuario' })).toMatchObject({ success: true, detail });
    expect(approveAsset).toHaveBeenCalledWith(detail.run.id, 'usuario', undefined);
  });

  it('conserva compromisos y evidencia sin crear borradores de exportación', () => {
    const original = createRunDetailFixture().latest_asset!.payload;
    const asset = { ...original, commitments: [{ statement: 'Revisar el informe', owner_candidate: 'Ana', status: 'open' as const, due_date_candidate: '2026-10-20', confidence: 0.9, evidence_refs: [{ excerpt: 'Ana revisará el informe' }] }] };
    const result = new MeetingReviewService().enrichMeetingAsset({ asset });
    expect(result.commitments).toEqual(asset.commitments);
    expect(result.executive_summary).toBe(asset.executive_summary);
    expect(result.proposed_actions).toEqual([]);
    expect(result.review_flags.some(flag => flag.code === 'missing_project_target')).toBe(false);
    expect(asset.commitments).toHaveLength(1);
  });
});
