import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { clampFloatingPosition, type FloatingBounds, type FloatingPoint } from './floating-chat-position';

function measure(root: RefObject<HTMLDivElement | null>) {
  const element = root.current, parent = element?.offsetParent;
  if (!element || !(parent instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect(), outer = parent.getBoundingClientRect();
  return { element, panel: rect, surface: outer, origin: { left: rect.left - outer.left, top: rect.top - outer.top } };
}

export function useFloatingChatPosition(root: RefObject<HTMLDivElement | null>, onBoundsChange?: (bounds: FloatingBounds) => void) {
  const [position, setPosition] = useState<FloatingPoint | null>(null), [dragging, setDragging] = useState(false);
  const positionRef = useRef(position), callback = useRef(onBoundsChange);
  const session = useRef<{ id: number; x: number; y: number; origin: FloatingPoint } | null>(null);
  useLayoutEffect(() => { callback.current = onBoundsChange; }, [onBoundsChange]);
  const move = (point: FloatingPoint) => {
    const geometry = measure(root); if (!geometry) return;
    const next = clampFloatingPosition(point, geometry.panel, geometry.surface);
    positionRef.current = next; setPosition(next);
  };
  useLayoutEffect(() => {
    const element = root.current, parent = element?.offsetParent;
    if (!element || !(parent instanceof HTMLElement)) return;
    const update = () => {
      const geometry = measure(root); if (!geometry) return;
      element.style.setProperty('--soflia-floating-surface-height', `${Math.max(60, geometry.surface.height - 16)}px`);
      const current = positionRef.current;
      if (current) {
        const next = clampFloatingPosition(current, geometry.panel, geometry.surface);
        if (next.left !== current.left || next.top !== current.top) { positionRef.current = next; setPosition(next); }
      }
      const point = positionRef.current ?? geometry.origin;
      callback.current?.({ ...point, width: geometry.panel.width, height: geometry.panel.height, moved: !!positionRef.current });
    };
    const observer = new ResizeObserver(update); observer.observe(element); observer.observe(parent); update();
    const cancel = () => { session.current = null; setDragging(false); };
    window.addEventListener('blur', cancel);
    return () => { observer.disconnect(); window.removeEventListener('blur', cancel); };
  }, [root]);
  useLayoutEffect(() => {
    const geometry = measure(root);
    if (geometry) callback.current?.({ ...(position ?? geometry.origin), width: geometry.panel.width, height: geometry.panel.height, moved: !!position });
  }, [position, root]);
  const stop = (event: PointerEvent<HTMLElement>) => {
    if (session.current?.id !== event.pointerId) return;
    session.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    dragging,
    style: position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' } as CSSProperties : undefined,
    grip: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || session.current) return;
        const geometry = measure(root); if (!geometry) return;
        event.preventDefault(); session.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: geometry.origin };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const start = session.current; if (!start || start.id !== event.pointerId) return;
        move({ left: start.origin.left + event.clientX - start.x, top: start.origin.top + event.clientY - start.y });
      },
      onPointerUp: stop, onPointerCancel: stop,
      onLostPointerCapture: () => { session.current = null; setDragging(false); },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const deltas: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const delta = deltas[event.key]; if (!delta) return;
        event.preventDefault(); const geometry = measure(root); if (!geometry) return;
        const amount = event.shiftKey ? 32 : 12;
        move({ left: geometry.origin.left + delta[0] * amount, top: geometry.origin.top + delta[1] * amount });
      },
    },
  };
}
