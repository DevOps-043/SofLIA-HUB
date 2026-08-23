import { describe, expect, it } from 'vitest';
import { toolBudgetExhaustedMessage } from '../../services/gemini-chat/tool-budget';

describe('cierre honesto del presupuesto de herramientas', () => {
  it('TOOL-BUDGET-001: nunca afirma éxito si el modelo no produjo respuesta final', () => {
    const message = toolBudgetExhaustedMessage([{
      name: 'read_active_document',
      args: {},
      result: JSON.stringify({ success: true }),
    }]);

    expect(message).toContain('No pude completar');
    expect(message).toContain('no produjo una respuesta final verificable');
    expect(message).not.toContain('He ejecutado las acciones solicitadas');
  });

  it('TOOL-BUDGET-002: informa el último error sin presentarlo como éxito', () => {
    const message = toolBudgetExhaustedMessage([{
      name: 'read_active_document',
      args: {},
      result: JSON.stringify({ success: false, error: 'El documento cambió durante la lectura.' }),
    }]);

    expect(message).toContain('El documento cambió durante la lectura.');
    expect(message).toContain('No asumiré que la tarea terminó');
  });
});
