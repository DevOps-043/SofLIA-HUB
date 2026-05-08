import type { VisualScreenCapture } from './capture';

const RECT_SIZE = 80;

export function buildFailureOverlay(capture: VisualScreenCapture, x: number, y: number): Buffer {
  const scaledX = Math.round(x * capture.scaleFactor);
  const scaledY = Math.round(y * capture.scaleFactor);
  const safeX = Math.max(0, Math.min(scaledX, capture.imgWidth));
  const safeY = Math.max(0, Math.min(scaledY, capture.imgHeight));
  const halfSize = RECT_SIZE / 2;

  return Buffer.from(`
    <svg width="${capture.imgWidth}" height="${capture.imgHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${capture.imgWidth}" height="${capture.imgHeight}" fill="rgba(0,0,0,0.15)" />
      <rect x="${safeX - halfSize}" y="${safeY - halfSize}" width="${RECT_SIZE}" height="${RECT_SIZE}"
            fill="none" stroke="#FF0000" stroke-width="6" stroke-dasharray="10,5" />
      <circle cx="${safeX}" cy="${safeY}" r="6" fill="#FF0000" />
      <text x="${safeX + halfSize + 15}" y="${safeY + 8}"
            fill="#FF0000" font-size="28" font-family="sans-serif" font-weight="bold"
            stroke="#FFFFFF" stroke-width="2" paint-order="stroke">
        Zona de Fallo
      </text>
    </svg>
  `);
}
