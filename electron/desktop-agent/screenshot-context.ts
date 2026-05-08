import { screen as electronScreen } from 'electron';
import type { ScreenshotLayout } from './types';
import { getVirtualDesktopBounds } from './screenshot-layout';

export function describeScreenshotMonitorContext(layout: ScreenshotLayout | null): string {
  if (!layout) return '';

  const desktopBounds = getVirtualDesktopBounds(electronScreen.getAllDisplays());
  const hasMultipleDisplays = layout.displayRegions.length > 1;
  const hasPadding = layout.offsetX > 0 || layout.offsetY > 0;
  const isFocusedCrop =
    layout.virtualBounds.x !== desktopBounds.x
    || layout.virtualBounds.y !== desktopBounds.y
    || layout.virtualBounds.width !== desktopBounds.width
    || layout.virtualBounds.height !== desktopBounds.height;

  if (!hasMultipleDisplays && !hasPadding && !isFocusedCrop) return '';

  const regions = layout.displayRegions
    .map((region, index) => {
      const right = region.left + region.width;
      const bottom = region.top + region.height;
      return `- Monitor ${index + 1}: ocupa x=${region.left}-${right}, y=${region.top}-${bottom} dentro de la imagen`;
    })
    .join('\n');
  const paddingNote = hasPadding
    ? `Fuera de esas regiones hay padding oscuro agregado por el compositor (offset ${layout.offsetX},${layout.offsetY}). Evita clickear ahi.`
    : '';
  const focusedNote = isFocusedCrop
    ? `La captura esta recortada a una region enfocada del escritorio: x=${layout.virtualBounds.x}-${layout.virtualBounds.x + layout.virtualBounds.width}, y=${layout.virtualBounds.y}-${layout.virtualBounds.y + layout.virtualBounds.height}.`
    : '';

  return `REGIONES DE MONITOR EN LA IMAGEN:
${regions}
${paddingNote}
${focusedNote}
`;
}
