import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(root, 'src/assets/soflia-avatar');
await fs.mkdir(directory, { recursive: true });
const source = path.join(directory, 'original.png');
if (process.argv[2]) await fs.copyFile(path.resolve(process.argv[2]), source);
const input = await fs.readFile(source);
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== 1312 || info.height !== 1199) throw new Error('La fuente aprobada debe medir 1312 × 1199.');
const { width, height } = info;
const svg = content => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
// Contorno visible: no se reconstruyen superficies traseras ni bandas ocultas.
const contour = svg('<path fill="white" d="M 655 90 C 758 87 876 179 956 305 C 1076 340 1157 394 1169 460 C 1180 520 1151 597 1128 655 C 1107 755 1050 824 953 861 C 878 951 778 1022 651 1022 C 559 1019 494 962 446 910 C 330 871 245 802 213 701 C 162 656 147 611 167 548 C 193 457 244 372 339 338 C 410 216 565 89 655 90 Z"/>');
await fs.writeFile(path.join(directory, 'silhouette.svg'), contour);
const alpha = await sharp(Buffer.from(contour)).ensureAlpha().raw().toBuffer();
// Corrección visual solicitada: pantalla uniforme, sin cuencas ni profundidad ocular.
const visor = svg('<path fill="white" d="M 310 578 C 375 510 461 460 567 443 C 740 470 901 530 1033 625 C 1068 675 975 748 851 789 C 690 847 532 847 440 784 C 392 744 345 665 310 578 Z"/>');
await fs.writeFile(path.join(directory, 'visor.svg'), visor);
const visorAlpha = await sharp(Buffer.from(visor)).blur(3).ensureAlpha().raw().toBuffer();
const faceSample = (720 * width + 650) * 4;
const body = Buffer.from(data);
const left = Buffer.alloc(data.length);
const right = Buffer.alloc(data.length);
const light = Buffer.alloc(data.length);

// Masqueado suave: se conservan píxeles y resplandor, con fondo del propio visor.
function eyeMask(x, y, cx, rx) {
  const radius = Math.hypot((x - cx) / rx, (y - 608) / 86);
  return Math.max(0, Math.min(1, (1 - radius) / 0.22));
}
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    body[index + 3] = alpha[index + 3];
    const eyeLeft = eyeMask(x, y, 511, 143);
    const eyeRight = eyeMask(x, y, 833, 132);
    const mask = visorAlpha[index + 3] / 255;
    if (mask > 0) {
      for (let channel = 0; channel < 3; channel++) body[index + channel] = Math.round(data[index + channel] * (1 - mask) + data[faceSample + channel] * mask);
    }
    for (const [layer, amount] of [[left, eyeLeft], [right, eyeRight]]) {
      if (!amount) continue;
      for (let channel = 0; channel < 3; channel++) layer[index + channel] = data[index + channel];
      const emission = Math.max(0, Math.min(1, (Math.max(data[index + 1], data[index + 2]) - 22) / 100));
      layer[index + 3] = Math.round(255 * amount * emission);
    }
    // El pulso ilumina sólo píxeles turquesa existentes en las bandas/indicadores.
    const cyan = Math.min(data[index + 1], data[index + 2]) - data[index];
    const band = (y > 680 || (x > 950 && y > 290)) && alpha[index + 3] > 0;
    if (band && cyan > 70) {
      light.set(data.subarray(index, index + 3), index);
      light[index + 3] = Math.round(Math.min(1, (cyan - 70) / 120) * alpha[index + 3]);
    }
  }
}
const save = (name, bytes) => sharp(bytes, { raw: { width, height, channels: 4 } }).png().toFile(path.join(directory, name));
await Promise.all([save('body.png', body), save('eye-left.png', left), save('eye-right.png', right), save('light.png', light)]);
const still = Buffer.from(data);
for (let index = 3; index < still.length; index += 4) still[index] = alpha[index];
await save('original-cutout.png', still);
await fs.writeFile(path.join(directory, 'provenance.json'), JSON.stringify({
  source: 'Primera imagen aprobada adjunta por el usuario', width, height,
  sha256: createHash('sha256').update(input).digest('hex'),
  method: 'Contorno SVG; cuerpo, logo y bandas originales. Visor aplanado con muestra RGB de (650,720), según corrección del usuario; máscara SVG visor.svg. Ojos emisivos con transparencia, sin sombras oculares.',
  limitation: 'La pantalla se uniforma deliberadamente para eliminar cuencas. original-cutout.png conserva los píxeles originales; el componente usa expresiones SVG basadas en la referencia aprobada.',
}, null, 2) + '\n');
console.log('Recursos del avatar extraídos de la fuente aprobada.');
