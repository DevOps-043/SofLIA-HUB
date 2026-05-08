interface PromptFieldsProps {
  systemPrompt: string;
  starterPrompts: string;
  onSystemPromptChange: (value: string) => void;
  onStarterPromptsChange: (value: string) => void;
}

export function PromptFields({
  systemPrompt,
  starterPrompts,
  onSystemPromptChange,
  onStarterPromptsChange,
}: PromptFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-white">Instrucciones del Sistema *</label>
        <p className="text-xs text-gray-500 m-0">Define como debe comportarse la IA cuando uses esta herramienta.</p>
        <textarea
          placeholder="Ej: Eres un experto en marketing digital..."
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none resize-y font-sans leading-relaxed focus:border-accent/50 transition-colors"
          rows={6}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-white">Prompts de Inicio (opcional)</label>
        <p className="text-xs text-gray-500 m-0">Sugerencias que apareceran al usar la herramienta. Una por linea.</p>
        <textarea
          placeholder={'Como puedo mejorar mi copy?\nEscribe un titular para...\nAnaliza esta campana'}
          value={starterPrompts}
          onChange={(e) => onStarterPromptsChange(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 text-white text-sm outline-none resize-y font-sans leading-relaxed focus:border-accent/50 transition-colors"
          rows={3}
        />
      </div>
    </>
  );
}
