interface Point {
  x: number;
  y: number;
}

interface ScreenPointConverter {
  dipToScreenPoint?: (point: Point) => Point;
  screenToDipPoint?: (point: Point) => Point;
}

export function convertDipToScreenPoint(converter: ScreenPointConverter, point: Point): Point {
  try {
    const converted = converter.dipToScreenPoint?.({
      x: Math.round(point.x),
      y: Math.round(point.y),
    });
    if (converted && Number.isFinite(converted.x) && Number.isFinite(converted.y)) {
      return { x: Math.round(converted.x), y: Math.round(converted.y) };
    }
  } catch {
    // Fall through to identity conversion.
  }

  return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function convertScreenToDipPoint(converter: ScreenPointConverter, point: Point): Point {
  try {
    const converted = converter.screenToDipPoint?.({
      x: Math.round(point.x),
      y: Math.round(point.y),
    });
    if (converted && Number.isFinite(converted.x) && Number.isFinite(converted.y)) {
      return { x: converted.x, y: converted.y };
    }
  } catch {
    // Fall through to identity conversion.
  }

  return { x: point.x, y: point.y };
}
