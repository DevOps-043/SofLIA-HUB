/**
 * Script to generate NSIS installer images from PNG sources.
 * 
 * NSIS requires BMP images with specific dimensions:
 * - Sidebar (installerSidebar): 164x314 pixels
 * - Header (installerHeaderIcon): 150x57 pixels
 * 
 * Uses sharp to resize, then manually creates BMP files from raw pixel data.
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build', 'installer');

// Ensure output directory exists
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

/**
 * Convert raw RGBA pixel buffer to 24-bit BMP format
 */
function createBMP(rawBuffer, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4; // Row size must be multiple of 4
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize; // 14 (file header) + 40 (info header) + pixel data

  const bmp = Buffer.alloc(fileSize);

  // BMP File Header (14 bytes)
  bmp.write('BM', 0);                    // Signature
  bmp.writeUInt32LE(fileSize, 2);         // File size
  bmp.writeUInt16LE(0, 6);               // Reserved
  bmp.writeUInt16LE(0, 8);               // Reserved
  bmp.writeUInt32LE(54, 10);             // Pixel data offset

  // BMP Info Header (40 bytes)
  bmp.writeUInt32LE(40, 14);             // Info header size
  bmp.writeInt32LE(width, 18);           // Width
  bmp.writeInt32LE(height, 22);          // Height (positive = bottom-up)
  bmp.writeUInt16LE(1, 26);             // Color planes
  bmp.writeUInt16LE(24, 28);            // Bits per pixel (24-bit)
  bmp.writeUInt32LE(0, 30);             // Compression (none)
  bmp.writeUInt32LE(pixelDataSize, 34); // Image size
  bmp.writeInt32LE(2835, 38);           // Horizontal resolution (72 DPI)
  bmp.writeInt32LE(2835, 42);           // Vertical resolution (72 DPI)
  bmp.writeUInt32LE(0, 46);             // Colors in palette
  bmp.writeUInt32LE(0, 50);             // Important colors

  // Pixel data (BMP stores bottom-up, BGR format)
  for (let y = height - 1; y >= 0; y--) {
    const bmpRow = (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4; // RGBA
      const dstIdx = 54 + bmpRow + x * 3;
      bmp[dstIdx] = rawBuffer[srcIdx + 2];     // B
      bmp[dstIdx + 1] = rawBuffer[srcIdx + 1]; // G
      bmp[dstIdx + 2] = rawBuffer[srcIdx];     // R
    }
  }

  return bmp;
}

async function generateImage(srcPath, dstPath, width, height, label) {
  console.log(`📐 Creating ${label} (${width}x${height})...`);
  
  const { data } = await sharp(srcPath)
    .resize(width, height, { fit: 'cover' })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const bmpBuffer = createBMP(data, width, height);
  fs.writeFileSync(dstPath, bmpBuffer);
  console.log(`   ✅ ${path.basename(dstPath)}`);
}

async function generateImages() {
  const sourceDir = path.join(buildDir, 'sources');
  
  console.log('🎨 Generating NSIS installer images...\n');

  // Installer sidebar (164x314)
  await generateImage(
    path.join(sourceDir, 'sidebar.png'),
    path.join(buildDir, 'installerSidebar.bmp'),
    164, 314, 'installer sidebar'
  );

  // Uninstaller sidebar (164x314)
  await generateImage(
    path.join(sourceDir, 'uninstaller-sidebar.png'),
    path.join(buildDir, 'uninstallerSidebar.bmp'),
    164, 314, 'uninstaller sidebar'
  );

  // Installer header (150x57)
  await generateImage(
    path.join(sourceDir, 'header.png'),
    path.join(buildDir, 'installerHeader.bmp'),
    150, 57, 'installer header'
  );

  // Uninstaller header (150x57)
  await generateImage(
    path.join(sourceDir, 'header.png'),
    path.join(buildDir, 'uninstallerHeader.bmp'),
    150, 57, 'uninstaller header'
  );

  console.log('\n🎉 All installer images generated successfully!');
  console.log(`   Output directory: ${buildDir}`);
}

generateImages().catch(err => {
  console.error('❌ Error generating images:', err);
  process.exit(1);
});
