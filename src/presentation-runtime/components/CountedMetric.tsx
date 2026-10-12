import { animate } from 'framer-motion';
import { useEffect, useState } from 'react';

export function CountedMetric({ value, count, enabled }: { value: string; count?: { numero: number; prefijo?: string; sufijo?: string; decimales: number }; enabled: boolean }) {
  const [current, setCurrent] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled || !count) return;
    const animation = animate(0, count.numero, { duration: 1.25, onUpdate: setCurrent, onComplete: () => setCurrent(null) });
    return () => animation.stop();
  }, [count, enabled]);
  const text = enabled && count && current !== null ? `${count.prefijo ?? ''}${current.toLocaleString('es-MX', { minimumFractionDigits: count.decimales, maximumFractionDigits: count.decimales })}${count.sufijo ?? ''}` : value;
  return <span aria-label={value}>{text}</span>;
}
