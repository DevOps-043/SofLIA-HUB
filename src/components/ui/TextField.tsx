import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from './cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Icono opcional a la izquierda del input. */
  icon?: ReactNode;
  wrapperClassName?: string;
}

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-gray-900 dark:text-white placeholder-secondary/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors';

export function TextField({ label, icon, wrapperClassName, className, id, ...rest }: TextFieldProps) {
  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-secondary mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">
            {icon}
          </span>
        )}
        <input id={id} className={cn(INPUT_CLASS, icon && 'pl-10', className)} {...rest} />
      </div>
    </div>
  );
}
