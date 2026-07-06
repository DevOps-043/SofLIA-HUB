export { ElementLocator, describeLocateAttempts } from './element-locator';
export { createUiaLocatorProvider, pickBestElement } from './uia-provider';
export { createOcrLocatorProvider } from './ocr-provider';
export { normalizeVisibleText, scoreTextMatch } from './text-matching';
export type {
  ElementLocatorProvider,
  ElementSource,
  ImagePoint,
  LocateOptions,
  LocateAttempt,
  LocateResult,
  LocatedElement,
  PhysicalPoint,
  Rect,
  SpatialHint,
  BlockedTarget,
} from './types';
