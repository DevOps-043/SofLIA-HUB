import { afterEach, describe, expect, it, vi } from 'vitest';
import { orbGuidanceService, type OrbGuidanceBridge } from '../../services/orb-guidance-service';
import { initialGuidanceState } from '../../shared/orb-guidance';
import { executeComputerTool } from '../../services/computer-use-service';
import { COMPUTER_TOOL_NAMES } from '../../services/gemini-tools/tool-names';

afterEach(() => { delete window.orbGuidance; });
describe('wrapper y herramienta de señalización', () => {
  it('señala por texto mediante el puente sin iniciar Computer Use', async () => {
    const showTarget = vi.fn(async () => ({ success: true, state: initialGuidanceState() }));
    window.orbGuidance = { showTarget } as unknown as OrbGuidanceBridge;
    expect(COMPUTER_TOOL_NAMES.has('show_visual_guidance')).toBe(true);
    const result = JSON.parse(await executeComputerTool('show_visual_guidance', { target_text: 'Insertar', instruction: 'Abre este menú', style: 'arrow' }));
    expect(result.success).toBe(true);
    expect(showTarget).toHaveBeenCalledWith({ targetText: 'Insertar', instruction: 'Abre este menú', style: 'arrow' });
  });
  it('falla claramente cuando el puente no está disponible', () => {
    expect(orbGuidanceService.available()).toBe(false);
    expect(() => orbGuidanceService.getState()).toThrow('no está disponible');
  });
});
