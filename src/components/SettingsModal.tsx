import React, { useState, useEffect } from 'react';
import { loadSettings, saveSettings, type UserAISettings } from '../services/settings-service';
import SelectDropdown from './ui/SelectDropdown';

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

// SelectDropdown importado de ./ui/SelectDropdown

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
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      setIsInitialized(false);
      loadSettings(userId).then(settings => {
        setNickname(settings.nickname);
        setOccupation(settings.occupation);
        setAboutUser(settings.about_user);
        setToneStyle(settings.tone_style);
        setCharEmojis(settings.char_emojis);
        setCustomInstructions(settings.custom_instructions);
        setLoading(false);
        setTimeout(() => setIsInitialized(true), 500); // Wait for renders to settle
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

  // Auto-save effect
  useEffect(() => {
    if (!isInitialized || !isOpen) return;

    const timeoutId = setTimeout(() => {
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

      saveSettings(settings).then(success => {
        if (success) {
          onSave?.(settings);
          // Auto-save proactive config as well
          if (window.proactive) {
            window.proactive.updateConfig({
              enabled: proactiveEnabled,
              notificationHours: notifHours,
              calendarReminders,
              taskReminders,
              systemAlerts,
            });
          }
        }
        setSaving(false);
      });
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timeoutId);
  }, [
    nickname, occupation, aboutUser, toneStyle, charEmojis, customInstructions,
    proactiveEnabled, notifHours, calendarReminders, taskReminders, systemAlerts,
    isInitialized, isOpen, userId
  ]);

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
          : 'w-175 max-h-[85vh] bg-white dark:bg-sidebar rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl animate-fade-in relative'
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
              <h2 className="text-gray-900 dark:text-white text-xl font-black uppercase tracking-widest leading-none">Mi Identidad</h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-tighter mt-1">Configuración del motor de personalización</p>
            </div>

          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-black/[0.02] dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-visible no-scrollbar px-6 py-6 pb-32 relative z-10 space-y-6">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-white/5 rounded-full" />
              <div className="absolute inset-0 w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em] animate-pulse">Analizando Perfil...</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-32">
            {/* Card: Bio Data */}
            <div className="bg-white/[0.03] backdrop-blur-md border border-white/[0.05] rounded-[2rem] p-6 relative overflow-visible group hover:border-accent/10 transition-all duration-500 shadow-xl shadow-black/10">
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
                <svg className="w-32 h-32 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
              
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center border border-accent/10 group-hover:scale-105 transition-transform duration-500">
                  <svg className="w-4 h-4 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-gray-900 dark:text-white/90 uppercase tracking-[0.2em]">Contexto de Identidad</h4>
                  <p className="text-[8px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mt-0.5 whitespace-nowrap">Quién eres para tu IA</p>
                </div>

              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 relative z-10">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1 ml-1 flex items-center gap-2">
                    Seudónimo / Apodo
                  </label>
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="Fer"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.03] rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/20 dark:focus:border-accent/20 focus:bg-white dark:focus:bg-black/40 transition-all placeholder-gray-400 dark:placeholder-gray-700"
                  />

                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1 ml-1 flex items-center gap-2">
                    Especialidad / Rol
                  </label>
                  <input
                    value={occupation}
                    onChange={e => setOccupation(e.target.value)}
                    placeholder="CEO / CTO"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.03] rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/20 dark:focus:border-accent/20 focus:bg-white dark:focus:bg-black/40 transition-all placeholder-gray-400 dark:placeholder-gray-700"
                  />

                </div>
              </div>


              <div className="space-y-1.5 relative z-10">
                <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1 ml-1 flex items-center gap-2">
                  Memorias y Experiencias
                </label>
                <textarea
                  value={aboutUser}
                  onChange={e => setAboutUser(e.target.value)}
                  placeholder="Información relevante para tu contexto..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.03] rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/20 dark:focus:border-accent/20 focus:bg-white dark:focus:bg-black/40 transition-all placeholder-gray-400 dark:placeholder-gray-700 resize-none h-24 no-scrollbar"
                />

                <p className="text-[7px] text-gray-600 font-medium uppercase tracking-widest mt-1 px-1 text-right">Persistencia de contexto activa</p>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50/50 dark:bg-white/[0.03] backdrop-blur-md border border-gray-100 dark:border-white/[0.05] rounded-[2rem] p-6 flex flex-col group hover:border-accent/10 transition-all duration-500 shadow-xl shadow-black/5 dark:shadow-black/10 relative overflow-visible z-20">

                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
                  <svg className="w-32 h-32 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-8 h-8 rounded-lg bg-gray-500/5 flex items-center justify-center border border-white/5 transition-all duration-500 group-hover:bg-accent/5 group-hover:border-accent/10 group-hover:scale-105">
                    <svg className="w-4 h-4 text-gray-500 group-hover:text-accent/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-900 dark:text-white/90 uppercase tracking-[0.2em]">Sintonía Basal</h4>
                    <p className="text-[8px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mt-0.5">Tono y personalidad</p>
                  </div>

                </div>
                <div className="space-y-4 flex-1 flex flex-col justify-center relative z-10">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1 ml-1 flex items-center gap-2">
                      Registros de Voz
                    </label>
                    <SelectDropdown value={toneStyle} onChange={setToneStyle} options={TONE_OPTIONS} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1 ml-1 flex items-center gap-2">
                      Densidad Expresiva
                    </label>
                    <SelectDropdown value={charEmojis} onChange={setCharEmojis} options={EMOJI_OPTIONS} />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50/50 dark:bg-white/[0.03] backdrop-blur-md border border-gray-100 dark:border-white/[0.05] rounded-[2rem] p-6 relative group overflow-visible hover:border-accent/10 transition-all duration-500 shadow-xl shadow-black/5 dark:shadow-black/10">

                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
                  <svg className="w-32 h-32 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-8 h-8 rounded-lg bg-accent/5 flex items-center justify-center border border-accent/10 group-hover:scale-105 transition-transform duration-500">
                    <svg className="w-4 h-4 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-gray-900 dark:text-white/90 uppercase tracking-[0.2em]">Instrucciones</h4>
                    <p className="text-[8px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mt-0.5">Lógica de control maestro</p>
                  </div>

                </div>
                <div className="space-y-1.5 relative z-10">
                  <textarea
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="Ej: 'Prioriza código limpio'..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.03] rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:border-accent/20 dark:focus:border-accent/20 focus:bg-white dark:focus:bg-black/40 transition-all placeholder-gray-400 dark:placeholder-gray-700 resize-none h-24 no-scrollbar"
                  />

                  <p className="text-[7px] text-gray-600 font-medium uppercase tracking-widest mt-1 px-1">Sobrescribe comportamientos estándar</p>
                </div>
              </div>
            </div>


            {/* Notification System Block */}
            {window.proactive && (
              <div className="bg-gray-50/50 dark:bg-white/[0.03] backdrop-blur-md border border-gray-100 dark:border-white/[0.05] rounded-[2rem] p-6 relative overflow-hidden group">

                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-700">
                  <svg className="w-32 h-32 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-500 ${proactiveEnabled ? 'bg-purple-500/10 border-purple-500/20 shadow-lg shadow-purple-500/5 scale-105' : 'bg-white/5 border-white/5 grayscale'}`}>
                       <svg className={`w-5 h-5 transition-colors duration-500 ${proactiveEnabled ? 'text-purple-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                       </svg>
                    </div>
                    <div>
                       <h4 className="text-[10px] font-bold text-gray-900 dark:text-white/90 uppercase tracking-[0.2em]">SofLIA Proactiva</h4>
                       <p className="text-[8px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">WhatsApp Autónomo</p>
                    </div>

                  </div>
                  <button
                    onClick={() => setProactiveEnabled(!proactiveEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-500 ${
                      proactiveEnabled ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-white/10'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                      proactiveEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {proactiveEnabled && (
                  <div className="space-y-6 animate-in fade-in duration-500 relative z-10">
                    {/* Feature Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {[
                        { id: 'cal', active: calendarReminders, set: setCalendarReminders, icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, label: 'Eventos' },
                        { id: 'prj', active: taskReminders, set: setTaskReminders, icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>, label: 'Tareas' },
                        { id: 'sys', active: systemAlerts, set: setSystemAlerts, icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>, label: 'Status' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => f.set(!f.active)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all ${
                            f.active ? 'bg-purple-500/5 border-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-white/[0.03] text-gray-400 dark:text-gray-700'
                          }`}

                        >
                          {f.icon}
                          <span className="flex-1 text-left">{f.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Timeline Matrix */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[8px] font-bold text-gray-500 uppercase tracking-widest px-1">Ventanas de Interacción</label>
                      </div>
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
                        {Array.from({ length: 24 }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => toggleHour(i)}
                            className={`flex flex-col items-center justify-center py-1.5 rounded-lg border transition-all ${
                              notifHours.includes(i)
                                ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-200'
                                : 'bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-white/[0.02] text-gray-400 dark:text-gray-800'
                            }`}

                          >
                            <span className="text-[9px] font-mono font-bold leading-none">{String(i).padStart(2, '0')}</span>
                            <div className={`mt-1.5 w-1 h-1 rounded-full transition-all ${notifHours.includes(i) ? 'bg-purple-400 scale-100 shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'bg-white/5 scale-50'}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Technical Command / Test */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/[0.02] rounded-xl p-3">

                      <button
                        onClick={handleTestNotification}
                        disabled={proactiveTesting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600/90 text-white text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-purple-600/10 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {proactiveTesting ? (
                          <div className="w-3 h-3 border-1.5 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        )}
                        <span>Sincronizar</span>
                      </button>
                      <div className="flex-1 flex items-center overflow-hidden h-4">
                        {proactiveTestResult && <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest truncate">{proactiveTestResult}</p>}
                        {!proactiveTestResult && <p className="text-[8px] text-gray-700 font-medium uppercase tracking-tight">Requiere WhatsApp vinculado.</p>}
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
      <div className="px-8 py-5 border-t border-gray-100 dark:border-white/[0.05] bg-white/80 dark:bg-[#0c0d10]/80 backdrop-blur-xl flex items-center justify-between relative z-20">

        <div className="flex items-center gap-2">
           <div className={`w-1.5 h-1.5 rounded-full ${saving ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-accent/30'}`} />
           <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{saving ? 'Guardando...' : 'Sincronización Lista'}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[9px] font-bold text-gray-600 hover:text-white uppercase tracking-widest transition-colors"
          >
            Abortar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="group relative px-8 py-2.5 rounded-xl bg-accent text-white text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 overflow-hidden"
          >
            <span className="relative z-10">{saving ? 'Procesando...' : 'Aplicar Cambios'}</span>
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
