import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to project root
const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build', 'installer');
const SRC_DIR = path.join(BUILD_DIR, 'sources');
const BG_COLOR = '#12151a'; // Premium dark background (Match with installer.nsh)

/**
 * Convert sharp raw pixel data to a 24-bit BMP buffer.
 * BMP stores rows bottom-to-top and in BGR order.
 */
function rawToBmp(rawBuffer, width, height, channels) {
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows padded to 4-byte boundary
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize; // 14 (file header) + 40 (DIB header) + pixel data

  const bmp = Buffer.alloc(fileSize);

  // -- BMP File Header (14 bytes) --
  bmp.write('BM', 0);                    // Signature
  bmp.writeUInt32LE(fileSize, 2);         // File size
  bmp.writeUInt32LE(0, 6);               // Reserved
  bmp.writeUInt32LE(54, 10);             // Pixel data offset

  // -- DIB Header (BITMAPINFOHEADER, 40 bytes) --
  bmp.writeUInt32LE(40, 14);             // DIB header size
  bmp.writeInt32LE(width, 18);           // Width
  bmp.writeInt32LE(height, 22);          // Height (positive = bottom-up)
  bmp.writeUInt16LE(1, 26);             // Color planes
  bmp.writeUInt16LE(24, 28);            // Bits per pixel
  bmp.writeUInt32LE(0, 30);             // Compression (none)
  bmp.writeUInt32LE(pixelDataSize, 34);  // Image size
  bmp.writeInt32LE(2835, 38);           // X pixels per meter (~72 DPI)
  bmp.writeInt32LE(2835, 42);           // Y pixels per meter
  bmp.writeUInt32LE(0, 46);             // Colors in table
  bmp.writeUInt32LE(0, 50);             // Important colors

  // -- Pixel Data (bottom-up, BGR) --
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * channels; // flip vertically
    const dstRow = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = srcRow + x * channels;
      const dstIdx = dstRow + x * 3;
      bmp[dstIdx] = rawBuffer[srcIdx + 2];     // B
      bmp[dstIdx + 1] = rawBuffer[srcIdx + 1]; // G
      bmp[dstIdx + 2] = rawBuffer[srcIdx];     // R
    }
  }

  return bmp;
}

async function sharpToBmp(pipeline, outPath) {
  const { data, info } = await pipeline
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bmpBuffer = rawToBmp(data, info.width, info.height, info.channels);
  fs.writeFileSync(outPath, bmpBuffer);
}

async function generateBitmaps() {
  console.log('Regenerating installer bitmaps...');
  try {
    // Generate Header (NSIS: 150x57)
    await sharpToBmp(
      sharp(path.join(SRC_DIR, 'header.png'))
        .resize({ width: 150, height: 57, fit: 'contain', background: BG_COLOR }),
      path.join(BUILD_DIR, 'installerHeader.bmp')
    );

    await sharpToBmp(
      sharp(path.join(SRC_DIR, 'header.png'))
        .resize({ width: 150, height: 57, fit: 'contain', background: BG_COLOR }),
      path.join(BUILD_DIR, 'uninstallerHeader.bmp')
    );

    // Generate Sidebar (NSIS: 164x314)
    await sharpToBmp(
      sharp(path.join(SRC_DIR, 'sidebar.png'))
        .resize({ width: 164, height: 314, fit: 'cover', position: 'center' }),
      path.join(BUILD_DIR, 'installerSidebar.bmp')
    );

    await sharpToBmp(
      sharp(path.join(SRC_DIR, 'uninstaller-sidebar.png'))
        .resize({ width: 164, height: 314, fit: 'cover', position: 'center' }),
      path.join(BUILD_DIR, 'uninstallerSidebar.bmp')
    );

    console.log('Bitmaps regenerated successfully.');
  } catch (err) {
    console.error('Error generating bitmaps:', err);
    process.exit(1);
  }
}

generateBitmaps();
