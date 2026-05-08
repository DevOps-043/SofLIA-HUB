const GRID_STEP = 100;
const MONITOR_WIDTH = 1280;
const MONITOR_HEIGHT = 720;

export async function renderMarkedScreenBuffer(sharp: any, thumbnail: any): Promise<Buffer | null> {
  if (thumbnail.isEmpty()) return null;

  const { width, height } = thumbnail.getSize();
  const pngBuffer = thumbnail.toPNG();
  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${buildGridOverlayElements(width, height)}
    </svg>
  `);

  return sharp(pngBuffer)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .toBuffer();
}

export async function composeMonitorBuffers(sharp: any, processedBuffers: Buffer[]): Promise<Buffer | undefined> {
  if (processedBuffers.length === 0) return undefined;
  if (processedBuffers.length === 1) return processedBuffers[0];

  return sharp({
    create: {
      width: processedBuffers.length * MONITOR_WIDTH,
      height: MONITOR_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(
      processedBuffers.map((input, index) => ({
        input,
        left: index * MONITOR_WIDTH,
        top: 0,
      })),
    )
    .png()
    .toBuffer();
}

function buildGridOverlayElements(width: number, height: number): string {
  const elements: string[] = [];

  for (let x = 0; x < width; x += GRID_STEP) {
    elements.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255, 0, 0, 0.2)" stroke-width="1" />`);
    elements.push(`<text x="${x + 2}" y="12" fill="rgba(255, 0, 0, 0.6)" font-size="10" font-family="monospace">${x}</text>`);
  }

  for (let y = 0; y < height; y += GRID_STEP) {
    elements.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255, 0, 0, 0.2)" stroke-width="1" />`);
    elements.push(`<text x="2" y="${y + 12}" fill="rgba(255, 0, 0, 0.6)" font-size="10" font-family="monospace">${y}</text>`);
  }

  return elements.join('');
}
