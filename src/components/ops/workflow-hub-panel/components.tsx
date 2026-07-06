import { prettyValue, tone } from './formatters';

export function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wide border ${tone(value)}`}>
      {prettyValue(value)}
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-6 flex items-center justify-center">
      <span className="text-[13px] text-secondary">{text}</span>
    </div>
  );
}
