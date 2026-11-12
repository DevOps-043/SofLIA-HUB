import type { SVGProps } from 'react';

/** Base decorativa compartida; el control conserva su nombre y sus eventos. */
export function IconGlyph({ children, className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      aria-hidden="true"
      focusable="false"
      className={`hub-icon ${className}`}
    >
      <g className="hub-icon-art">{children}</g>
    </svg>
  );
}
