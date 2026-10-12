/** Conecta bordes de nodos; el marcador no queda oculto dentro de la tarjeta. */
export function nodeConnector(a: { x: number; y: number }, b: { x: number; y: number }, width: number, height: number, gap = 0) {
  const ax = a.x + width / 2, ay = a.y + height / 2, bx = b.x + width / 2, by = b.y + height / 2;
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
  if (!length) throw new Error('Los nodos conectados deben tener posiciones distintas.');
  const t = Math.min(dx ? width / 2 / Math.abs(dx) : Infinity, dy ? height / 2 / Math.abs(dy) : Infinity) + gap / length;
  return { x1: ax + dx * t, y1: ay + dy * t, x2: bx - dx * t, y2: by - dy * t };
}
