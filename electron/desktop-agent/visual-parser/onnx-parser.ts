import { createRequire } from 'node:module';
import fs from 'node:fs';
import { loadSharp, type SharpFactory } from '../sharp';
import { clampBox, computeLetterbox, mapBoxToOriginal, type Letterbox } from './letterbox';
import { decodeYoloV8Output, nonMaxSuppression, resolveYoloLayout } from './yolo-postprocess';
import type { VisualBox, VisualParser } from './types';

/**
 * Parser visual sobre onnxruntime-node (CPU, sin Python) con el detector de
 * iconos de OmniParser exportado a ONNX. Sigue el patron del resto de modulos
 * nativos del proyecto (sharp): carga OPCIONAL y degradacion elegante — si
 * onnxruntime no esta instalado o el modelo no existe, `disponible()` devuelve
 * false y el composite sigue con UIA+OCR. Activarlo requiere:
 *   1) instalar `onnxruntime-node` (N-API prebuilt, como nut.js), y
 *   2) colocar el modelo ONNX en la ruta resuelta por `resolveModelPath`.
 */

// Superficie minima de onnxruntime-node que usamos (sin dependencia de tipos).
type OrtTensor = { data: ArrayLike<number>; dims: number[] };
type OrtSession = {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>>;
};
type OrtModule = {
  InferenceSession: { create: (path: string) => Promise<OrtSession> };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
};

export type OnnxParserOptions = {
  /** Devuelve la ruta del .onnx, o null si no esta disponible. */
  resolveModelPath: () => string | null;
  /** Lado de la entrada cuadrada del modelo (YOLOv8 por defecto 640). */
  inputSize?: number;
  scoreThreshold?: number;
  nmsIouThreshold?: number;
  /** Inyectables para test; por defecto se cargan perezosamente los nativos. */
  loadOrt?: () => OrtModule | null;
  sharpModule?: SharpFactory | null;
};

const DEFAULT_INPUT_SIZE = 640;
const DEFAULT_SCORE_THRESHOLD = 0.05;
const DEFAULT_NMS_IOU = 0.1;
const PAD_COLOR = { r: 114, g: 114, b: 114 };

export function loadOnnxRuntime(): OrtModule | null {
  try {
    const requireFromModule = createRequire(import.meta.url);
    return requireFromModule('onnxruntime-node') as OrtModule;
  } catch {
    return null;
  }
}

export function createOnnxVisualParser(options: OnnxParserOptions): VisualParser {
  const inputSize = options.inputSize ?? DEFAULT_INPUT_SIZE;
  const scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  const nmsIou = options.nmsIouThreshold ?? DEFAULT_NMS_IOU;
  const loadOrt = options.loadOrt ?? loadOnnxRuntime;
  const sharpModule = options.sharpModule ?? loadSharp();

  let ort: OrtModule | null | undefined;
  let session: OrtSession | null = null;
  let sessionPromise: Promise<OrtSession | null> | null = null;

  function getOrt(): OrtModule | null {
    if (ort === undefined) ort = loadOrt();
    return ort;
  }

  function getModelPath(): string | null {
    return options.resolveModelPath();
  }

  function modelExists(modelPath: string | null): boolean {
    return Boolean(modelPath && fs.existsSync(modelPath));
  }

  function runtimeDisponible(): boolean {
    const modelPath = getModelPath();
    return Boolean(getOrt() && sharpModule && modelExists(modelPath));
  }

  async function ensureSession(): Promise<OrtSession | null> {
    if (session) return session;
    if (!runtimeDisponible()) return null;
    if (!sessionPromise) {
      const modelPath = options.resolveModelPath();
      if (!modelPath || !fs.existsSync(modelPath)) return null;
      sessionPromise = ort!.InferenceSession.create(modelPath)
        .then((created) => { session = created; return created; })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('[DesktopAgent] No se pudo cargar el modelo ONNX del parser visual:', message);
          sessionPromise = null;
          return null;
        });
    }
    return sessionPromise;
  }

  return {
    disponible: () => runtimeDisponible(),
    diagnostico: () => {
      const modelPath = getModelPath();
      const runtime = Boolean(getOrt());
      const sharp = Boolean(sharpModule);
      const exists = modelExists(modelPath);
      return {
        runtimeDisponible: runtime,
        sharpDisponible: sharp,
        modeloPath: modelPath,
        modeloExiste: exists,
        disponible: Boolean(runtime && sharp && exists),
      };
    },
    async detectar(base64: string): Promise<VisualBox[]> {
      const activeSession = await ensureSession();
      if (!activeSession || !sharpModule || !ort) return [];

      const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const pre = await preprocess(sharpModule, buffer, inputSize);
      if (!pre) return [];

      const tensor = new ort.Tensor('float32', pre.tensor, [1, 3, inputSize, inputSize]);
      const feeds: Record<string, unknown> = { [activeSession.inputNames[0]]: tensor };
      const results = await activeSession.run(feeds);
      const output = results[activeSession.outputNames[0]];
      if (!output || output.dims.length !== 3) return [];

      // Detecta feature-major [1,4+nc,anchors] vs anchor-major [1,anchors,4+nc]
      // por el tamano de cada eje (las anclas son el eje grande, ~8400).
      const { layout, numAnchors, numClasses } = resolveYoloLayout(output.dims);
      if (numClasses < 1) return [];

      const data = output.data instanceof Float32Array ? output.data : Float32Array.from(output.data);
      const cajasEntrada = decodeYoloV8Output(data, { numAnchors, numClasses, scoreThreshold, layout });
      const suprimidas = nonMaxSuppression(cajasEntrada, nmsIou);
      return suprimidas
        .map((caja) => clampBox(mapBoxToOriginal(caja, pre.letterbox), pre.origWidth, pre.origHeight))
        .filter((caja) => caja.x1 - caja.x0 > 1 && caja.y1 - caja.y0 > 1);
    },
  };
}

type Preprocessed = {
  tensor: Float32Array;
  letterbox: Letterbox;
  origWidth: number;
  origHeight: number;
};

/** Reescala con letterbox y arma el tensor NCHW RGB normalizado [0,1]. */
async function preprocess(sharpModule: SharpFactory, buffer: Buffer, inputSize: number): Promise<Preprocessed | null> {
  const base = sharpModule(buffer).removeAlpha();
  const metadata = await base.metadata();
  const origWidth = metadata.width ?? 0;
  const origHeight = metadata.height ?? 0;
  if (origWidth <= 0 || origHeight <= 0) return null;

  const lb = computeLetterbox(origWidth, origHeight, inputSize);
  const padLeft = Math.floor(lb.padX);
  const padTop = Math.floor(lb.padY);
  const padRight = inputSize - lb.resizedWidth - padLeft;
  const padBottom = inputSize - lb.resizedHeight - padTop;

  const raw = await base
    .resize(lb.resizedWidth, lb.resizedHeight, { fit: 'fill' })
    .extend({ top: padTop, bottom: padBottom, left: padLeft, right: padRight, background: PAD_COLOR })
    .raw()
    .toBuffer();

  const area = inputSize * inputSize;
  const tensor = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    tensor[i] = raw[i * 3] / 255;             // R
    tensor[area + i] = raw[i * 3 + 1] / 255;  // G
    tensor[2 * area + i] = raw[i * 3 + 2] / 255; // B
  }

  // Mapear de vuelta con los pads ENTEROS realmente aplicados.
  const mappingLetterbox: Letterbox = { ...lb, padX: padLeft, padY: padTop };
  return { tensor, letterbox: mappingLetterbox, origWidth, origHeight };
}
