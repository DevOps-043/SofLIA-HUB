export function buildAutomationRun(id: string, templateId: string) {
  return {
    id,
    templateId,
    title: `Caso ${id}`,
    status: 'needs_approval',
    summary: `Resumen ${id}`,
    requestedBy: 'app:user_1',
    createdAt: '2026-03-22T18:00:00.000Z',
    updatedAt: '2026-03-22T18:10:00.000Z',
    input: {},
    source: null,
    preview: { summary: 'ok' },
    actions: [{
      id: `${id}-a1`,
      kind: 'gmail_send',
      title: 'Enviar correo',
      status: 'pending',
      payload: { to: 'demo@empresa.com' },
    }],
    approvals: [],
    logs: [],
  };
}
