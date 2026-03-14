import { useState, useEffect, useCallback } from 'react';

// ─── Cron helpers ─────────────────────────────────────────────────────

export function parseCron(cron: string): { hour: number; minute: number; days: string[] } {
  const parts = cron.split(' ');
  const minute = parseInt(parts[0]) || 0;
  const hour = parseInt(parts[1]) || 0;
  const dowPart = parts[4] || '*';
  const days = dowPart === '*' ? ['*'] : dowPart.split(',');
  return { hour, minute, days };
}

export function buildCron(hour: number, minute: number, days: string[]): string {
  const dow = days.includes('*') || days.length === 0 || days.length === 7 ? '*' : days.join(',');
  return `${minute} ${hour} * * ${dow}`;
}

export function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const mins = Math.round((end - start) / 60000);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function formatTime(h: number, m: number): string {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

// ─── Constants ────────────────────────────────────────────────────────

export const CATEGORY_INFO: Record<string, { label: string; color: string; bg: string }> = {
  security: { label: 'Seguridad', color: 'text-red-400', bg: 'border-red-500/30 bg-red-500/10' },
  quality: { label: 'Calidad', color: 'text-blue-400', bg: 'border-blue-500/30 bg-blue-500/10' },
  performance: { label: 'Rendimiento', color: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/10' },
  dependencies: { label: 'Dependencias', color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
  tests: { label: 'Tests', color: 'text-purple-400', bg: 'border-purple-500/30 bg-purple-500/10' },
};

export const QUICK_TIMES = [
  { label: '12:00 AM', hour: 0 },
  { label: '3:00 AM', hour: 3 },
  { label: '6:00 AM', hour: 6 },
  { label: '9:00 AM', hour: 9 },
  { label: '12:00 PM', hour: 12 },
  { label: '3:00 PM', hour: 15 },
  { label: '6:00 PM', hour: 18 },
  { label: '9:00 PM', hour: 21 },
];

export const DAYS_OF_WEEK = [
  { label: 'L', cron: '1', name: 'Lunes' },
  { label: 'M', cron: '2', name: 'Martes' },
  { label: 'X', cron: '3', name: 'Miércoles' },
  { label: 'J', cron: '4', name: 'Jueves' },
  { label: 'V', cron: '5', name: 'Viernes' },
  { label: 'S', cron: '6', name: 'Sábado' },
  { label: 'D', cron: '0', name: 'Domingo' },
];

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  researching: { label: 'Investigando...', color: 'text-blue-400' },
  analyzing: { label: 'Analizando código...', color: 'text-cyan-400' },
  planning: { label: 'Planificando mejoras...', color: 'text-indigo-400' },
  coding: { label: 'Programando...', color: 'text-emerald-400' },
  verifying: { label: 'Verificando build...', color: 'text-amber-400' },
  pushing: { label: 'Creando PR...', color: 'text-purple-400' },
  completed: { label: 'Completado', color: 'text-emerald-400' },
  failed: { label: 'Falló', color: 'text-red-400' },
  aborted: { label: 'Abortado', color: 'text-gray-400' },
};

export const STATUS_PROGRESS: Record<string, number> = {
  researching: 15,
  analyzing: 35,
  planning: 50,
  coding: 70,
  verifying: 85,
  pushing: 95,
  completed: 100,
  failed: 100,
  aborted: 100,
};

// ─── Hook ─────────────────────────────────────────────────────────────

export function useAutoDevPanel(isOpen: boolean) {
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'config' | 'history'>('schedule');
  const [customHour, setCustomHour] = useState(3);
  const [customMinute, setCustomMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<string[]>(['*']);

  const loadData = useCallback(async () => {
    if (!window.autodev) return;
    try {
      const [configRes, statusRes, historyRes] = await Promise.all([
        window.autodev.getConfig(),
        window.autodev.getStatus(),
        window.autodev.getHistory(),
      ]);
      if (configRes.success) {
        setConfig(configRes.config);
        const parsed = parseCron(configRes.config.cronSchedule);
        setCustomHour(parsed.hour);
        setCustomMinute(parsed.minute);
        setSelectedDays(parsed.days);
      }
      if (statusRes.success) setStatus(statusRes);
      if (historyRes.success) setHistory(historyRes.history || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadData();

    window.autodev?.onRunStarted(() => loadData());
    window.autodev?.onRunCompleted(() => loadData());
    window.autodev?.onStatusChanged(() => loadData());

    return () => {
      window.autodev?.removeListeners();
    };
  }, [isOpen, loadData]);

  const updateConfig = async (updates: any) => {
    if (!window.autodev) return;
    setSaving(true);
    try {
      const res = await window.autodev.updateConfig(updates);
      if (res.success) setConfig(res.config);
    } catch { /* ignore */ }
    setTimeout(() => setSaving(false), 500);
  };

  const handleTimeChange = (hour: number, minute: number, days?: string[]) => {
    const d = days || selectedDays;
    setCustomHour(hour);
    setCustomMinute(minute);
    const cron = buildCron(hour, minute, d);
    updateConfig({ cronSchedule: cron });
  };

  const handleDayToggle = (day: string) => {
    let newDays: string[];
    if (day === '*') {
      newDays = ['*'];
    } else {
      const current = selectedDays.filter(d => d !== '*');
      if (current.includes(day)) {
        newDays = current.filter(d => d !== day);
        if (newDays.length === 0) newDays = ['*'];
      } else {
        newDays = [...current, day];
        if (newDays.length === 7) newDays = ['*'];
      }
    }
    setSelectedDays(newDays);
    handleTimeChange(customHour, customMinute, newDays);
  };

  const handleRunNow = async () => {
    if (!window.autodev) return;
    await window.autodev.runNow();
    setTimeout(loadData, 1000);
  };

  const handleAbort = async () => {
    if (!window.autodev) return;
    await window.autodev.abort();
    setTimeout(loadData, 1000);
  };

  const toggleCategory = (cat: string) => {
    if (!config) return;
    const cats = config.categories || [];
    const updated = cats.includes(cat) ? cats.filter((c: string) => c !== cat) : [...cats, cat];
    updateConfig({ categories: updated });
  };

  const nextRunText = () => {
    if (!config?.enabled) return 'Deshabilitado';
    const parsed = parseCron(config.cronSchedule);
    const daysText = parsed.days.includes('*')
      ? 'Todos los días'
      : parsed.days.map((d: string) => DAYS_OF_WEEK.find(dw => dw.cron === d)?.name || d).join(', ');
    return `${formatTime(parsed.hour, parsed.minute)} — ${daysText}`;
  };

  return {
    config, status, history, loading, saving,
    expandedRun, setExpandedRun,
    activeTab, setActiveTab,
    customHour, customMinute, selectedDays,
    updateConfig, handleTimeChange, handleDayToggle,
    handleRunNow, handleAbort, toggleCategory, nextRunText,
  };
}
