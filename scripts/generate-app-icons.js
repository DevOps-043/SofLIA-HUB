/**
 * Genera los iconos de aplicacion a partir del logotipo de marca.
 *
 * `public/assets/Icono.png` es el logotipo horizontal (1537x1023) que la UI
 * renderiza con object-contain, asi que no puede volverse cuadrado. Los
 * empaquetadores si exigen iconos cuadrados: NSIS rechaza cualquier .ico con
 * lado menor a 256 y macOS pide al menos 512x512 para construir el .icns.
 *
 * Este script recorta el margen transparente del logotipo, lo centra sobre un
 * lienzo cuadrado y emite los dos artefactos que consume electron-builder:
 *
 *   public/assets/icon.png   1024x1024  (mac + linux)
 *   public/assets/icono.ico  16..256    (windows + tray + favicon)
 *
 * Los archivos se versionan en el repositorio; ejecutar solo al cambiar la
 * marca: `node scripts/generate-app-icons.js`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'public', 'assets');

const SOURCE = path.join(ASSETS, 'Icono.png');
const MASTER_PNG = path.join(ASSETS, 'icon.png');
const ICO = path.join(ASSETS, 'icono.ico');

const MASTER_SIZE = 1024;
// Margen alrededor del logotipo dentro del lienzo cuadrado.
const PADDING_RATIO = 0.08;
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function buildSquareMaster() {
  // trim() elimina el margen transparente del logotipo para que la marca ocupe
  // todo el espacio util del lienzo en vez de quedar diminuta dentro del icono.
  const trimmed = await sharp(SOURCE).trim().png().toBuffer();
  const inner = Math.round(MASTER_SIZE * (1 - PADDING_RATIO * 2));

  const fitted = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: MASTER_SIZE,
      height: MASTER_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fitted, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`No se encontro el logotipo base: ${SOURCE}`);
  }

  const master = await buildSquareMaster();
  fs.writeFileSync(MASTER_PNG, master);

  const frames = await Promise.all(
    ICO_SIZES.map((size) => sharp(master).resize(size, size).png().toBuffer()),
  );
  fs.writeFileSync(ICO, await pngToIco(frames));

  console.log(`[icons] ${path.relative(ROOT, MASTER_PNG)} ${MASTER_SIZE}x${MASTER_SIZE}`);
  console.log(`[icons] ${path.relative(ROOT, ICO)} ${ICO_SIZES.join(', ')}`);
}

main().catch((error) => {
  console.error('[icons] Fallo la generacion de iconos:', error);
  process.exit(1);
});
