import type { TextareaHTMLAttributes } from 'react';

import { cn } from './cn';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  wrapperClassName?: string;
}

const TEXTAREA_CLASS =
  'w-full px-3.5 py-3 rounded-xl bg-surface-2 border border-border text-sm text-gray-900 dark:text-white placeholder-secondary/70 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors resize-none';

export function TextArea({ label, wrapperClassName, className, id, rows = 4, ...rest }: TextAreaProps) {
  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-secondary mb-1.5">
          {label}
        </label>
      )}
      <textarea id={id} rows={rows} className={cn(TEXTAREA_CLASS, className)} {...rest} />
    </div>
  );
}
