/**
 * Extraccion de la paleta de marca a partir del LOGO de la organizacion.
 *
 * Las columnas `brand_color_*` suelen estar sin configurar o con el azul por
 * defecto, mientras que el logo si es real. Derivar los colores del propio
 * logo hace que la presentacion se vea de la organizacion aunque nadie haya
 * rellenado la paleta a mano.
 *
 * La funcion de extraccion es PURA (recibe pixeles) para poder probarla sin
 * Electron; el adaptador que decodifica el archivo vive en `logo-colors.ts`.
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ExtractedPalette {
  /** Color dominante saturado; encabezados y elementos de marca. */
  primary: string;
  /** Segundo color distinto; apoyos y fondos de acento. */
  secondary: string;
  /** Tercer color distinto; detalles y realces. */
  accent: string;
  /** Colores encontrados, del mas al menos frecuente. */
  all: string[];
}

/** Pixeles muy transparentes no aportan color de marca. */
const MIN_ALPHA = 128;
/** Descarta blancos, negros y grises: son fondo, no identidad. */
const MIN_SATURATION = 0.22;
const MIN_LIGHTNESS = 0.12;
const MAX_LIGHTNESS = 0.94;
/** Distancia minima entre colores elegidos para que no sean el mismo tono. */
const MIN_COLOR_DISTANCE = 60;
/** Cota de pixeles analizados: un logo grande no debe costar segundos. */
const MAX_SAMPLES = 40_000;

/**
 * Extrae la paleta de un bitmap BGRA (el formato que devuelve
 * `nativeImage.getBitmap()` en Electron).
 *
 * Devuelve null si el logo no aporta ningun color utilizable, por ejemplo un
 * logo monocromo en blanco y negro. En ese caso el llamador conserva los
 * colores declarados o el tema neutro, en vez de inventar una identidad.
 */
export function extractPaletteFromBgra(
  bitmap: Uint8Array | Buffer,
  width: number,
  height: number,
): ExtractedPalette | null {
  const totalPixels = width * height;
  if (totalPixels <= 0 || bitmap.length < totalPixels * 4) return null;

  // Muestreo uniforme: recorre el logo entero en vez de solo su esquina.
  const step = Math.max(1, Math.floor(totalPixels / MAX_SAMPLES));
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let pixel = 0; pixel < totalPixels; pixel += step) {
    const offset = pixel * 4;
    const alpha = bitmap[offset + 3];
    if (alpha < MIN_ALPHA) continue;

    // BGRA, no RGBA: invertir el orden es el error clasico aqui.
    const b = bitmap[offset];
    const g = bitmap[offset + 1];
    const r = bitmap[offset + 2];

    const { saturation, lightness } = describeColor(r, g, b);
    if (saturation < MIN_SATURATION) continue;
    if (lightness < MIN_LIGHTNESS || lightness > MAX_LIGHTNESS) continue;

    // Cuantizacion a 5 bits por canal: agrupa tonos casi iguales del
    // antialiasing sin fundir colores de marca distintos.
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  if (buckets.size === 0) return null;

  const ordered = [...buckets.values()]
    .sort((left, right) => right.count - left.count)
    .map((bucket) => ({
      count: bucket.count,
      color: {
        r: Math.round(bucket.r / bucket.count),
        g: Math.round(bucket.g / bucket.count),
        b: Math.round(bucket.b / bucket.count),
      },
    }));

  const chosen: RgbColor[] = [];
  for (const entry of ordered) {
    if (chosen.every((color) => distance(color, entry.color) >= MIN_COLOR_DISTANCE)) {
      chosen.push(entry.color);
    }
    if (chosen.length === 6) break;
  }

  if (chosen.length === 0) return null;

  const all = chosen.map(toHex);
  return {
    primary: all[0],
    // Con un logo de un solo color se derivan los apoyos de ese mismo tono en
    // vez de dejar huecos: mejor una gama coherente que un color ajeno.
    secondary: all[1] ?? toHex(shade(chosen[0], -0.28)),
    accent: all[2] ?? toHex(shade(chosen[0], 0.34)),
    all,
  };
}

/** `#rrggbb` en minusculas. */
export function toHex(color: RgbColor): string {
  const channel = (value: number) => clampByte(value).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

export function parseHex(value: string): RgbColor | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/**
 * Aclara (ratio positivo) u oscurece (negativo) un color conservando su tono.
 * Se usa para derivar apoyos y para garantizar contraste sobre el fondo.
 */
export function shade(color: RgbColor, ratio: number): RgbColor {
  const target = ratio >= 0 ? 255 : 0;
  const amount = Math.min(1, Math.abs(ratio));
  return {
    r: Math.round(color.r + (target - color.r) * amount),
    g: Math.round(color.g + (target - color.g) * amount),
    b: Math.round(color.b + (target - color.b) * amount),
  };
}

/** Luminancia relativa WCAG. */
export function relativeLuminance(color: RgbColor): number {
  const channel = (value: number) => {
    const normalized = clampByte(value) / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(a: RgbColor, b: RgbColor): number {
  const left = relativeLuminance(a);
  const right = relativeLuminance(b);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Oscurece un color hasta alcanzar el contraste minimo pedido contra el
 * fondo. Un logo amarillo o cian es legible en su propio soporte, pero como
 * color de texto sobre blanco es ilegible; esto lo corrige sin cambiar el tono.
 */
export function ensureContrast(color: RgbColor, background: RgbColor, minimum = 4.5): RgbColor {
  if (contrastRatio(color, background) >= minimum) return color;

  const towardsDark = relativeLuminance(background) > 0.5;
  let candidate = color;
  for (let step = 1; step <= 20; step += 1) {
    candidate = shade(color, (towardsDark ? -1 : 1) * (step * 0.05));
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return candidate;
}

function describeColor(r: number, g: number, b: number): { saturation: number; lightness: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  if (max === min) return { saturation: 0, lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  return { saturation, lightness };
}

function distance(a: RgbColor, b: RgbColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
