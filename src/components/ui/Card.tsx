import type { ReactNode } from 'react';

import { cn } from './cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Añade padding interno estándar (p-6). Desactívalo para layouts a medida. */
  padded?: boolean;
  /** Resalta la tarjeta con borde/anillo de acento (estado seleccionado). */
  active?: boolean;
  onClick?: () => void;
}

/**
 * Superficie base del sistema SOFIA: sólida, borde de 1px, esquinas de 16px y
 * sombra sutil. Sin blur ni marcas de agua casi invisibles.
 */
export function Card({ children, className, padded = true, active = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl bg-surface border transition-colors',
        active ? 'border-accent/50 ring-1 ring-accent/20' : 'border-border',
        'shadow-sm dark:shadow-none',
        padded && 'p-6',
        onClick && 'cursor-pointer hover:border-accent/30',
        className,
      )}
    >
      {children}
    </div>
  );
}
