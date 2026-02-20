import React, { useState, useEffect, useRef } from 'react';
import { loadSettings, saveSettings, type UserAISettings } from '../services/settings-service';

// Declare the proactive API from preload
declare global {
  interface Window {
    proactive?: {
      getConfig: () => Promise<any>;
      updateConfig: (updates: any) => Promise<{ success: boolean; error?: string }>;
      triggerNow: (phoneNumber?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      getStatus: () => Promise<{ running: boolean; config: any }>;
    };
  }
}

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

  // Proactive notification state
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [notifHours, setNotifHours] = useState<number[]>([8, 20]);
  const [calendarReminders, setCalendarReminders] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [proactiveTesting, setProactiveTesting] = useState(false);
  const [proactiveTestResult, setProactiveTestResult] = useState('');

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

      // Load proactive config
      if (window.proactive) {
        window.proactive.getConfig().then((config: any) => {
          setProactiveEnabled(config.enabled ?? true);
          setNotifHours(config.notificationHours ?? [8, 20]);
          setCalendarReminders(config.calendarReminders ?? true);
          setTaskReminders(config.taskReminders ?? true);
          setSystemAlerts(config.systemAlerts ?? true);
        }).catch(() => {});
      }
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

    // Save proactive config
    if (window.proactive) {
      await window.proactive.updateConfig({
        enabled: proactiveEnabled,
        notificationHours: notifHours,
        calendarReminders,
        taskReminders,
        systemAlerts,
      });
    }

    setSaving(false);

    if (success) {
      onSave?.(settings);
      onClose();
    }
  };

  const handleTestNotification = async () => {
    if (!window.proactive) return;
    setProactiveTesting(true);
    setProactiveTestResult('');
    try {
      const result = await window.proactive.triggerNow();
      setProactiveTestResult(result.success ? (result.message || 'Enviado!') : (result.error || 'Error'));
    } catch {
      setProactiveTestResult('Error al enviar');
    } finally {
      setProactiveTesting(false);
      setTimeout(() => setProactiveTestResult(''), 5000);
    }
  };

  const toggleHour = (hour: number) => {
    setNotifHours(prev => 
      prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour].sort((a, b) => a - b)
    );
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

              {/* Proactive Notifications */}
              {window.proactive && (
                <div className="mb-6 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <h4 className="text-white text-[15px] font-semibold">Notificaciones Proactivas</h4>
                    </div>
                    <button
                      onClick={() => setProactiveEnabled(!proactiveEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        proactiveEnabled ? 'bg-accent' : 'bg-white/10'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        proactiveEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">SofLIA te enviará recordatorios por WhatsApp sobre tus eventos, tareas y alertas del sistema.</p>

                  {proactiveEnabled && (
                    <>
                      {/* Feature toggles */}
                      <div className="grid grid-cols-3 gap-3 mb-5">
                        <button
                          onClick={() => setCalendarReminders(!calendarReminders)}
                          className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-2 ${
                            calendarReminders ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/[0.02] border-white/10 text-gray-500'
                          }`}
                        >
                          <span>📅</span> Calendario
                        </button>
                        <button
                          onClick={() => setTaskReminders(!taskReminders)}
                          className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-2 ${
                            taskReminders ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/[0.02] border-white/10 text-gray-500'
                          }`}
                        >
                          <span>✅</span> Project Hub
                        </button>
                        <button
                          onClick={() => setSystemAlerts(!systemAlerts)}
                          className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-2 ${
                            systemAlerts ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-white/[0.02] border-white/10 text-gray-500'
                          }`}
                        >
                          <span>🖥️</span> Sistema
                        </button>
                      </div>

                      {/* Hour picker */}
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-400 mb-3">Horas de notificación (clic para activar/desactivar)</label>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: 24 }, (_, i) => (
                            <button
                              key={i}
                              onClick={() => toggleHour(i)}
                              className={`w-10 h-8 rounded-lg text-[11px] font-mono font-medium transition-all ${
                                notifHours.includes(i)
                                  ? 'bg-accent/20 border border-accent/40 text-accent'
                                  : 'bg-white/[0.02] border border-white/5 text-gray-600 hover:text-gray-400 hover:bg-white/5'
                              }`}
                            >
                              {String(i).padStart(2, '0')}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">
                          Activas: {notifHours.length > 0 ? notifHours.map(h => `${String(h).padStart(2, '0')}:00`).join(', ') : 'Ninguna'}
                        </p>
                      </div>

                      {/* Test button */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleTestNotification}
                          disabled={proactiveTesting}
                          className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                        >
                          {proactiveTesting ? (
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
                              Enviando...
                            </span>
                          ) : '🔔 Enviar Notificación de Prueba'}
                        </button>
                        {proactiveTestResult && (
                          <span className="text-xs text-gray-400 animate-pulse">{proactiveTestResult}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
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
