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
  embedded?: boolean;
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userId, onSave, embedded = false }) => {
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
      if (!embedded) onClose();
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

  if (!isOpen && !embedded) return null;

  const content = (
    <div
      className={`flex flex-col overflow-hidden transition-all duration-500 ${
        embedded
          ? 'w-full h-full'
          : 'w-175 max-h-[85vh] bg-sidebar rounded-3xl border border-white/10 shadow-2xl animate-fade-in relative'
      }`}
      onClick={e => e.stopPropagation()}
    >
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      {!embedded && (
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between relative z-10 bg-white/2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/5">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className="text-white text-xl font-black uppercase tracking-widest leading-none">Mi Identidad</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">Configuración del motor de personalización</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 relative z-10 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-white/5 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em] animate-pulse">Analizando Perfil...</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Card: Bio Data */}
            <div className="bg-white/3 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-4 bg-accent rounded-full" />
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Contexto de Identidad</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Seudónimo / Apodo</label>
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="Ej: Fer"
                    className="w-full px-4 py-2.5 bg-background-dark/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent/30 transition-all placeholder-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Especialidad / Rol</label>
                  <input
                    value={occupation}
                    onChange={e => setOccupation(e.target.value)}
                    placeholder="Ej: Software Engineer"
                    className="w-full px-4 py-2.5 bg-background-dark/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent/30 transition-all placeholder-gray-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Memorias y Experiencias</label>
                <textarea
                  value={aboutUser}
                  onChange={e => setAboutUser(e.target.value)}
                  placeholder="Información relevante que SofLIA debe conocer para entenderte mejor..."
                  className="w-full px-4 py-3 bg-background-dark/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent/30 transition-all placeholder-gray-700 resize-none h-24 custom-scrollbar"
                />
              </div>
            </div>

            {/* Card: Stylistic Engine */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/3 border border-white/10 rounded-3xl p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-6 text-gray-500 group-hover:text-accent transition-colors">
                  <div className="w-1.5 h-4 bg-gray-700 rounded-full" />
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Sintonía Basal</h4>
                </div>
                <div className="space-y-5 flex-1 flex flex-col justify-center">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Registros de Voz</label>
                    <SelectDropdown value={toneStyle} onChange={setToneStyle} options={TONE_OPTIONS} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest px-1">Densidad Expresiva (Emojis)</label>
                    <SelectDropdown value={charEmojis} onChange={setCharEmojis} options={EMOJI_OPTIONS} />
                  </div>
                </div>
              </div>

              <div className="bg-white/3 border border-white/10 rounded-3xl p-6 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg className="w-16 h-16 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-4 bg-accent rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                  <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Instrucciones de Alto Nivel</h4>
                </div>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tight mb-4 pr-10">Lógica de control maestro para todas las respuestas.</p>
                <textarea
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  placeholder="Ej: 'Siempre responde en inglés', 'Prioriza código limpio', 'Evita saludos'..."
                  className="w-full px-4 py-3 bg-background-dark/80 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-accent/30 transition-all placeholder-gray-700 resize-none h-28 custom-scrollbar"
                />
              </div>
            </div>

            {/* Notification System Block */}
            {window.proactive && (
              <div className="bg-white/3 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px]" />
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 ${proactiveEnabled ? 'bg-purple-500/10 border-purple-500/20 shadow-lg shadow-purple-500/10 scale-110' : 'bg-white/5 border-white/10 grayscale'}`}>
                       <svg className={`w-6 h-6 transition-colors duration-500 ${proactiveEnabled ? 'text-purple-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                       </svg>
                    </div>
                    <div>
                       <h4 className="text-sm font-black text-white uppercase tracking-widest">SofLIA Proactiva</h4>
                       <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter mt-1">Interacción autónoma por WhatsApp</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setProactiveEnabled(!proactiveEnabled)}
                    className={`relative inline-flex h-7 w-13 items-center rounded-full transition-all duration-500 ${
                      proactiveEnabled ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-white/10'
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                      proactiveEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {proactiveEnabled && (
                  <div className="space-y-8 animate-in fade-in duration-500 relative z-10">
                    {/* Feature Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { id: 'cal', active: calendarReminders, set: setCalendarReminders, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, label: 'Calendario' },
                        { id: 'prj', active: taskReminders, set: setTaskReminders, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>, label: 'Proyectos' },
                        { id: 'sys', active: systemAlerts, set: setSystemAlerts, icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>, label: 'Alertas' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => f.set(!f.active)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                            f.active ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-background-dark/40 border-white/5 text-gray-600 grayscale opacity-60'
                          }`}
                        >
                          {f.icon}
                          <span className="flex-1 text-left">{f.label}</span>
                          {f.active && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
                        </button>
                      ))}
                    </div>

                    {/* Timeline Matrix */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Matriz de Vigilancia Temprana</label>
                        <span className="text-[10px] font-mono text-purple-500/60 font-bold uppercase tracking-tighter">Total: {notifHours.length} Ventanas</span>
                      </div>
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
                        {Array.from({ length: 24 }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => toggleHour(i)}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                              notifHours.includes(i)
                                ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                                : 'bg-background-dark/60 border-white/5 text-gray-700 hover:text-gray-400 hover:bg-white/5'
                            }`}
                          >
                            <span className="text-[10px] font-mono font-bold leading-none mb-1">{String(i).padStart(2, '0')}</span>
                            <div className={`w-1.5 h-1.5 rounded-full transition-all ${notifHours.includes(i) ? 'bg-purple-400 scale-100 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'bg-white/5 scale-50'}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Technical Command / Test */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-background-dark/40 border border-white/5 rounded-2xl p-4">
                      <button
                        onClick={handleTestNotification}
                        disabled={proactiveTesting}
                        className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-2.5 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-purple-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {proactiveTesting ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        )}
                        <span>Sincronizar Prueba</span>
                      </button>
                      <div className="flex-1 flex items-center gap-2 overflow-hidden h-4">
                        {proactiveTestResult && <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest animate-pulse truncate">{proactiveTestResult}</p>}
                        {!proactiveTestResult && <p className="text-[9px] text-gray-700 font-bold uppercase tracking-tight">Vincule su número primero para recibir la trama técnica.</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-5 border-t border-white/5 bg-white/2 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${saving ? 'bg-amber-500 animate-pulse' : 'bg-accent/40'}`} />
           <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">{saving ? 'Transfiriendo...' : 'Listo para sincronización'}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
          >
            Abortar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="group relative px-8 py-2.5 rounded-xl bg-accent text-primary text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/10 hover:shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10">{saving ? 'Guardando...' : 'Aplicar Cambios'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      {content}
    </div>
  );
};
