import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to project root
const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build', 'installer');
const SRC_DIR = path.join(BUILD_DIR, 'sources');
const BG_COLOR = '#0A2540';

const svg = (width, height, content, background = '#0A2540') => Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${background}"/>
  ${content}
</svg>`);

async function renderBrandSources() {
  fs.mkdirSync(SRC_DIR, { recursive: true });
  // Escena abstracta propia: conexiones del logotipo, sin texto rasterizado.
  // Se genera a 3x para mantener bordes limpios al escalar con DPI de Windows.
  const welcome = svg(540, 870, `
    <defs>
      <radialGradient id="glow"><stop stop-color="#00D4B3" stop-opacity=".25"/><stop offset="1" stop-color="#00D4B3" stop-opacity="0"/></radialGradient>
      <linearGradient id="orb" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#00D4B3"/><stop offset=".55" stop-color="#0A2540"/><stop offset="1" stop-color="#080B11"/></linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFFF" stop-opacity=".8"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".12"/></linearGradient>
    </defs>
    <circle cx="320" cy="400" r="380" fill="url(#glow)"/>
    <g fill="none" stroke="#0A2540" stroke-opacity=".12">
      <ellipse cx="312" cy="433" rx="215" ry="330" transform="rotate(-25 312 433)"/>
      <ellipse cx="312" cy="433" rx="170" ry="300" transform="rotate(30 312 433)"/>
    </g>
    <circle cx="328" cy="446" r="177" fill="url(#orb)"/>
    <circle cx="275" cy="386" r="138" fill="none" stroke="#FFFFFF" stroke-opacity=".12"/>
    <rect x="48" y="197" width="244" height="138" rx="25" fill="url(#glass)" stroke="#FFFFFF" stroke-width="2"/>
    <g fill="#0A2540" fill-opacity=".24"><rect x="78" y="225" width="100" height="8" rx="4"/><rect x="78" y="247" width="182" height="5" rx="2.5"/><rect x="78" y="263" width="153" height="5" rx="2.5"/></g>
    <path d="M78 302 L110 280 L140 296 L178 274 L206 288 L263 259" fill="none" stroke="#00D4B3" stroke-width="4"/>
    <g transform="translate(250 410)" stroke="#FFFFFF" stroke-width="8" fill="none" stroke-linecap="round"><path d="M0 42 L58 0 L112 42 M58 0 L58 93 L112 42"/></g>
    <g fill="#FFFFFF"><circle cx="250" cy="452" r="12"/><circle cx="308" cy="410" r="12"/><circle cx="308" cy="503" r="12"/><circle cx="362" cy="452" r="12"/></g>
    <rect x="75" y="592" width="226" height="85" rx="23" fill="url(#glass)" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="115" cy="634" r="16" fill="#0A2540"/>
    <path d="M108 634 L113 639 L123 628" stroke="#00D4B3" stroke-width="3" fill="none"/>
    <g fill="#0A2540" fill-opacity=".28"><rect x="148" y="620" width="122" height="7" rx="3.5"/><rect x="148" y="640" width="85" height="5" rx="2.5"/></g>
    <circle cx="98" cy="444" r="9" fill="#00D4B3"/><circle cx="448" cy="169" r="6" fill="#0A2540"/><circle cx="365" cy="730" r="8" fill="#00D4B3"/>
  `, '#F4FAF9');
  await sharp(welcome).png().toFile(path.join(SRC_DIR, 'welcome-scene.png'));
  await sharpToBmp(sharp(welcome), path.join(BUILD_DIR, 'welcome-scene.bmp'));
  const sidebarBase = svg(164, 314, `
    <path d="M22 50 L36 38 L50 48 M36 38 L36 62 L50 48" fill="none" stroke="#00D4B3" stroke-width="2"/>
    <circle cx="22" cy="50" r="4" fill="#FFFFFF"/><circle cx="36" cy="38" r="4" fill="#00D4B3"/><circle cx="36" cy="62" r="4" fill="#00D4B3"/><circle cx="50" cy="48" r="4" fill="#FFFFFF"/>
    <path d="M0 258 C44 222 66 269 111 230 C132 212 148 202 164 199" fill="none" stroke="#00D4B3" stroke-opacity=".2"/>
    <circle cx="21" cy="247" r="3" fill="#00D4B3" fill-opacity=".7"/>
    <circle cx="75" cy="248" r="2" fill="#FFFFFF" fill-opacity=".35"/>
    <circle cx="126" cy="217" r="3" fill="#00D4B3" fill-opacity=".5"/>
    <rect x="20" y="91" width="34" height="2" rx="1" fill="#00D4B3"/>
    <text x="20" y="124" fill="#FFFFFF" font-family="Inter,Segoe UI,Arial" font-size="23" font-weight="700">Pulse Hub</text>
    <text x="20" y="148" fill="#A7B8C8" font-family="Inter,Segoe UI,Arial" font-size="15">Tu espacio de IA</text>
    <text x="20" y="178" fill="#FFFFFF" fill-opacity=".7" font-family="Inter,Segoe UI,Arial" font-size="9">IA PARA TRABAJO</text>
    <text x="20" y="191" fill="#FFFFFF" fill-opacity=".7" font-family="Inter,Segoe UI,Arial" font-size="9">Y OPERACIONES</text>
    <text x="20" y="289" fill="#FFFFFF" fill-opacity=".42" font-family="Inter,Segoe UI,Arial" font-size="8">PULSE HUB</text>
  `);
  await sharp(sidebarBase).png().toFile(path.join(SRC_DIR, 'sidebar.png'));

  const uninstallBase = svg(164, 314, `
    <path d="M22 50 L36 38 L50 48 M36 38 L36 62 L50 48" fill="none" stroke="#6C757D" stroke-width="2"/>
    <circle cx="22" cy="50" r="4" fill="#FFFFFF"/><circle cx="36" cy="38" r="4" fill="#6C757D"/><circle cx="36" cy="62" r="4" fill="#6C757D"/><circle cx="50" cy="48" r="4" fill="#FFFFFF"/>
    <path d="M0 250 C50 215 98 269 164 214" fill="none" stroke="#00D4B3" stroke-opacity=".16"/>
    <rect x="20" y="91" width="34" height="2" rx="1" fill="#6C757D"/>
    <text x="20" y="124" fill="#FFFFFF" font-family="Inter,Segoe UI,Arial" font-size="23" font-weight="700">Pulse Hub</text>
    <text x="20" y="147" fill="#A7B8C8" font-family="Inter,Segoe UI,Arial" font-size="14">Desinstalar</text>
    <text x="20" y="177" fill="#FFFFFF" fill-opacity=".62" font-family="Inter,Segoe UI,Arial" font-size="9">CONTROL LIMPIO</text>
    <text x="20" y="190" fill="#FFFFFF" fill-opacity=".62" font-family="Inter,Segoe UI,Arial" font-size="9">Y TRANSPARENTE</text>
  `);
  await sharp(uninstallBase).png().toFile(path.join(SRC_DIR, 'uninstaller-sidebar.png'));

  const headerBase = svg(150, 57, `
    <rect y="55" width="150" height="2" fill="#00D4B3"/>
    <text x="12" y="25" fill="#0A2540" font-family="Inter,Segoe UI,Arial" font-size="14" font-weight="700">Pulse Hub</text>
    <text x="12" y="40" fill="#6C757D" font-family="Inter,Segoe UI,Arial" font-size="8">TU ESPACIO DE IA</text>
    <path d="M116 29 L126 20 L137 29 M126 20 L126 39 L137 29" fill="none" stroke="#00D4B3" stroke-width="1.5"/>
    <circle cx="116" cy="29" r="3" fill="#0A2540"/><circle cx="126" cy="20" r="3" fill="#00D4B3"/><circle cx="126" cy="39" r="3" fill="#00D4B3"/><circle cx="137" cy="29" r="3" fill="#0A2540"/>
  `, '#FFFFFF');
  await sharp(headerBase).png().toFile(path.join(SRC_DIR, 'header.png'));

  const dmgBase = svg(660, 400, `
    <circle cx="330" cy="204" r="126" fill="#00D4B3" fill-opacity=".035"/>
    <path d="M254 218 H397" stroke="#00D4B3" stroke-width="2" stroke-dasharray="5 7"/>
    <path d="M386 208 L400 218 L386 228" fill="none" stroke="#00D4B3" stroke-width="2"/>
    <text x="330" y="52" text-anchor="middle" fill="#0A2540" font-family="Inter,Segoe UI,Arial" font-size="24" font-weight="700">Pulse Hub</text>
    <text x="330" y="75" text-anchor="middle" fill="#6C757D" font-family="Inter,Segoe UI,Arial" font-size="12">Arrastra la aplicacion a Aplicaciones</text>
    <path d="M306 118 L330 98 L354 118 M330 98 L330 139 L354 118" fill="none" stroke="#00D4B3" stroke-width="3"/>
    <circle cx="306" cy="118" r="7" fill="#0A2540"/><circle cx="330" cy="98" r="7" fill="#00D4B3"/><circle cx="330" cy="139" r="7" fill="#00D4B3"/><circle cx="354" cy="118" r="7" fill="#0A2540"/>
    <text x="330" y="362" text-anchor="middle" fill="#6C757D" fill-opacity=".75" font-family="Inter,Segoe UI,Arial" font-size="10">Runtime privado de Python incluido</text>
  `, '#F4FAF9');
  await sharp(dmgBase).png().toFile(path.join(BUILD_DIR, 'dmg-background.png'));
}

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
  console.log('[Instalador] Generando recursos visuales Pulse Hub...');
  try {
    await renderBrandSources();
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

    console.log('[Instalador] Recursos visuales generados.');
  } catch (err) {
    console.error('[Instalador] Error al generar recursos visuales:', err);
    process.exit(1);
  }
}

generateBitmaps();
