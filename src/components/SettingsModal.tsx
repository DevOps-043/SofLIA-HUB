import React, { useState, useEffect, useRef } from 'react';
import { loadSettings, saveSettings, type UserAISettings } from '../services/settings-service';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSave?: (settings: UserAISettings) => void;
}

const TONE_OPTIONS = [
  { value: 'Profesional', label: 'Profesional' },
  { value: 'Casual', label: 'Casual / Amigable' },
  { value: 'Directo', label: 'Directo / Conciso' },
  { value: 'Académico', label: 'Academico / Formal' },
  { value: 'Entusiasta', label: 'Entusiasta' },
];

const EMOJI_OPTIONS = [
  { value: 'Auto', label: 'Automatico' },
  { value: 'Mínimo', label: 'Minimo / Serio' },
  { value: 'Moderado', label: 'Moderado' },
  { value: 'Muchos', label: 'Muchos / Divertido' },
];

// Custom dropdown component
const SelectDropdown: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.value === value)?.label || value;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm text-left flex items-center justify-between hover:border-accent/40 transition-colors"
      >
        <span>{selected}</span>
        <svg className={`w-4 h-4 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card-dark border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                value === opt.value
                  ? 'bg-accent/10 text-accent border-l-2 border-accent'
                  : 'text-white hover:bg-white/5 border-l-2 border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userId, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nickname, setNickname] = useState('');
  const [occupation, setOccupation] = useState('');
  const [aboutUser, setAboutUser] = useState('');
  const [toneStyle, setToneStyle] = useState('Profesional');
  const [charEmojis, setCharEmojis] = useState('Auto');
  const [customInstructions, setCustomInstructions] = useState('');

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      loadSettings(userId).then(settings => {
        setNickname(settings.nickname);
        setOccupation(settings.occupation);
        setAboutUser(settings.about_user);
        setToneStyle(settings.tone_style);
        setCharEmojis(settings.char_emojis);
        setCustomInstructions(settings.custom_instructions);
        setLoading(false);
      });
    }
  }, [isOpen, userId]);

  const handleSave = async () => {
    setSaving(true);
    const settings: UserAISettings = {
      user_id: userId,
      nickname,
      occupation,
      about_user: aboutUser,
      tone_style: toneStyle,
      char_emojis: charEmojis,
      custom_instructions: customInstructions,
    };

    const success = await saveSettings(settings);
    setSaving(false);

    if (success) {
      onSave?.(settings);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-h-[80vh] bg-sidebar rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h2 className="text-white text-lg font-semibold">Personalizacion</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          ) : (
            <>
              {/* About You */}
              <div className="mb-8">
                <h4 className="text-white text-[15px] font-semibold mb-4">Acerca de ti</h4>
                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Apodo / Como llamarte</label>
                    <input
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
                      placeholder="Ej: Fer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Ocupacion / Rol</label>
                    <input
                      value={occupation}
                      onChange={e => setOccupation(e.target.value)}
                      className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
                      placeholder="Ej: Ingeniero de Software"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Mas informacion de contexto</label>
                  <textarea
                    value={aboutUser}
                    onChange={e => setAboutUser(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors resize-none h-20"
                    placeholder="Intereses, ubicacion, o cualquier contexto util..."
                  />
                </div>
              </div>

              {/* Response Style */}
              <div className="mb-8">
                <h4 className="text-white text-[15px] font-semibold mb-4">Estilo de Respuesta</h4>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Tono Base</label>
                    <SelectDropdown value={toneStyle} onChange={setToneStyle} options={TONE_OPTIONS} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Uso de Emojis</label>
                    <SelectDropdown value={charEmojis} onChange={setCharEmojis} options={EMOJI_OPTIONS} />
                  </div>
                </div>
              </div>

              {/* Custom Instructions */}
              <div className="mb-6">
                <h4 className="text-white text-[15px] font-semibold mb-2">Instrucciones Personalizadas</h4>
                <p className="text-xs text-gray-400 mb-3">Esto tendra prioridad sobre otras configuraciones.</p>
                <textarea
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background-dark/80 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50 transition-colors resize-y min-h-[100px]"
                  placeholder="Ej: Siempre responde en listas con bullets. Nunca uses jerga tecnica compleja..."
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-white/20 text-white text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-accent text-primary text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-60 shadow-sm"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};
