import type { ScreenshotLayout, ScreenshotVirtualBounds } from './types';

// getDisplayRegionLabelFromScreenshotPoint vive en screenshot-coordinates.ts
// (fuente canonica); antes habia una copia identica aqui.

export function describeScreenshotMonitorContext(
  layout: ScreenshotLayout | null,
  desktopBounds: ScreenshotVirtualBounds,
  totalDisplays?: number,
): string {
  if (!layout) return '';
  const hasMultipleDisplays = layout.displayRegions.length > 1;
  const hasPadding = layout.offsetX > 0 || layout.offsetY > 0;
  const isFocusedCrop =
    layout.virtualBounds.x !== desktopBounds.x
    || layout.virtualBounds.y !== desktopBounds.y
    || layout.virtualBounds.width !== desktopBounds.width
    || layout.virtualBounds.height !== desktopBounds.height;
  const hiddenDisplays = (totalDisplays ?? layout.displayRegions.length) - layout.displayRegions.length;
  if (!hasMultipleDisplays && !hasPadding && !isFocusedCrop && hiddenDisplays <= 0) return '';

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
  const hiddenNote = hiddenDisplays > 0
    ? `ATENCION: estas viendo ${layout.displayRegions.length} de ${totalDisplays} monitores. Las ventanas de los otros ${hiddenDisplays} monitor(es) NO aparecen en la imagen. Para trabajar con una ventana que no ves, usa focus_window con parte de su titulo (revisa CONTEXTO DEL EQUIPO): la captura seguira automaticamente a la ventana activa. NO asumas que una app esta cerrada solo porque no la ves.`
    : '';

  return `REGIONES DE MONITOR EN LA IMAGEN:
${regions}
${paddingNote}
${focusedNote}
${hiddenNote}
`;
}
