interface PromptTextareaProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}

export function PromptTextarea({
  label,
  hint,
  value,
  onChange,
  rows,
  placeholder,
}: PromptTextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-white">{label}</label>
      <p className="text-xs text-gray-500 m-0">{hint}</p>
      <textarea
        placeholder={placeholder || 'Ej: Eres un experto en marketing digital...'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none resize-y font-sans leading-relaxed focus:border-accent/50 transition-colors"
        rows={rows}
      />
    </div>
  );
}
