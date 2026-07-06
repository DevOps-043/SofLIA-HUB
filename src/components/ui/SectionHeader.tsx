import type { ReactNode } from 'react';

import { cn } from './cn';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Contenido alineado a la derecha (acciones, toggles, badges). */
  action?: ReactNode;
  className?: string;
}

/**
 * Encabezado de sección/tarjeta del sistema SOFIA: icono + título legible en
 * caso normal (no uppercase diminuto) + subtítulo secundario opcional.
 */
export function SectionHeader({ title, subtitle, icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
          {subtitle && <p className="text-xs text-secondary mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
