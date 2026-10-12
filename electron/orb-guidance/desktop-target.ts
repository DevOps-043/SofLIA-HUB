import type { DesktopAgentService } from '../desktop-agent-service';
import type { GuidanceTarget } from '../../src/shared/orb-guidance';
import type { ResolvedActionTarget } from '../desktop-agent-types';
import { physicalRectToDipRect, screenToDipPoint } from '../desktop-agent/screenshot-coordinates';

export function desktopGuidanceTarget(service: Pick<DesktopAgentService, 'resolveScreenPoint'>, x: number, y: number, resolved?: ResolvedActionTarget | null): GuidanceTarget {
  const point = resolved?.centroFisico ? screenToDipPoint(resolved.centroFisico) : (() => {
    const physical = service.resolveScreenPoint(x, y);
    return physical.dipX !== undefined && physical.dipY !== undefined
      ? { x: physical.dipX, y: physical.dipY } : screenToDipPoint(physical);
  })();
  return { point, ...(resolved?.bboxFisico ? { rect: physicalRectToDipRect(resolved.bboxFisico) } : {}) };
}
