import { badgeTone, prettyStatus } from './formatters';

export function StatusBadge({ value, styles }: { value: string; styles: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide border ${badgeTone(value, styles)}`}>
      {prettyStatus(value)}
    </span>
  );
}
