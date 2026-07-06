import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  deletePassiveWorkflowRule,
  getWorkflowHubOverview,
  isWorkflowHubAvailable,
  savePassiveWorkflowRule,
  type PassiveWorkflowRule,
} from '../../services/workflow-hub-service';

interface WhatsAppFlowsCardProps {
  selectedTarget: string;
}

type ScheduleMode = 'once' | 'daily' | 'weekdays' | '1' | '2' | '3' | '4' | '5' | '6' | '0' | 'custom';

const SCHEDULE_OPTIONS: Array<{ value: ScheduleMode; label: string }> = [
  { value: 'once', label: 'Fecha exacta' },
  { value: 'daily', label: 'Todos los dias' },
  { value: 'weekdays', label: 'Lunes a viernes' },
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miercoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sabado' },
  { value: '0', label: 'Domingo' },
  { value: 'custom', label: 'Cron avanzado' },
];

export function WhatsAppFlowsCard({ selectedTarget }: WhatsAppFlowsCardProps) {
  const [rules, setRules] = useState<PassiveWorkflowRule[]>([]);
  const [name, setName] = useState('');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('once');
  const [scheduleDate, setScheduleDate] = useState(getTodayInputDate);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [customCronExpression, setCustomCronExpression] = useState('0 9 * * *');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target = useMemo(() => parseFlowTarget(selectedTarget), [selectedTarget]);
  const schedule = useMemo(
    () => buildSchedule(scheduleMode, scheduleDate, scheduleTime, customCronExpression),
    [customCronExpression, scheduleDate, scheduleMode, scheduleTime],
  );

  const loadRules = useCallback(async () => {
    if (!isWorkflowHubAvailable() || target.isGroup) return;
    setBusy('load');
    try {
      const result = await getWorkflowHubOverview();
      if (!result.success || !result.overview) throw new Error(result.error || 'Workflow Hub no disponible');
      setRules(result.overview.passiveRules.filter((rule) => matchesTarget(rule, target.phoneNumber)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude cargar los flujos');
    } finally {
      setBusy(null);
    }
  }, [target.isGroup, target.phoneNumber]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !prompt.trim()) {
      setError('Nombre e instruccion son obligatorios');
      return;
    }
    if (!schedule.cronExpression) {
      setError('Programacion obligatoria');
      return;
    }
    if (schedule.runOnce && schedule.scheduledFor && new Date(schedule.scheduledFor).getTime() <= Date.now()) {
      setError('La fecha y hora deben ser futuras');
      return;
    }
    setBusy('save');
    try {
      const result = await savePassiveWorkflowRule({
        name: name.trim(),
        prompt: prompt.trim(),
        cronExpression: schedule.cronExpression,
        scheduleLabel: schedule.scheduleLabel,
        runOnce: schedule.runOnce,
        scheduledFor: schedule.scheduledFor,
        requestedBy: target.phoneNumber ? `app:whatsapp:${target.phoneNumber}` : 'app:whatsapp:global',
        phoneNumber: target.phoneNumber || null,
        source: 'app',
        executionMode: 'agent_prompt',
      });
      if (!result.success) throw new Error(result.error || 'No pude guardar el flujo');
      setName('');
      setPrompt('');
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude guardar el flujo');
    } finally {
      setBusy(null);
    }
  }, [loadRules, name, prompt, schedule.cronExpression, schedule.runOnce, schedule.scheduleLabel, schedule.scheduledFor, target.phoneNumber]);

  const handleDelete = useCallback(async (ruleId: string) => {
    setBusy(ruleId);
    try {
      const result = await deletePassiveWorkflowRule(ruleId);
      if (!result.success) throw new Error(result.error || 'No pude eliminar el flujo');
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude eliminar el flujo');
    } finally {
      setBusy(null);
    }
  }, [loadRules]);

  if (!isWorkflowHubAvailable() || target.isGroup) return null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Flujos por Perfil</h3>
          <p className="text-xs text-secondary mt-0.5">{target.label}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadRules}>
          {busy === 'load' ? '...' : 'Actualizar'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_170px_140px_120px] gap-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre del flujo"
          className="px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
        />
        <select
          value={scheduleMode}
          onChange={(event) => setScheduleMode(event.target.value as ScheduleMode)}
          className="px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
        >
          {SCHEDULE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {scheduleMode === 'custom' ? (
          <input
            type="text"
            value={customCronExpression}
            onChange={(event) => setCustomCronExpression(event.target.value)}
            placeholder="0 9 * * *"
            className="md:col-span-2 px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
          />
        ) : (
          <>
            {scheduleMode === 'once' && (
              <input
                type="date"
                value={scheduleDate}
                min={getTodayInputDate()}
                onChange={(event) => setScheduleDate(event.target.value)}
                className="px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors"
              />
            )}
            <input
              type="time"
              value={scheduleTime}
              onChange={(event) => setScheduleTime(event.target.value)}
              className={`${scheduleMode === 'once' ? '' : 'md:col-span-2'} px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors`}
            />
          </>
        )}
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Instruccion que se ejecutara cuando se dispare"
          className="md:col-span-4 h-20 px-3 py-2.5 bg-surface-2 border border-border rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-colors resize-none"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-secondary">
          Programacion: <span className="font-medium text-gray-700 dark:text-gray-200">{schedule.scheduleLabel}</span>
        </p>
        <Button variant="primary" size="sm" onClick={handleSave} loading={busy === 'save'}>
          {busy === 'save' ? 'Guardando' : 'Crear flujo'}
        </Button>
      </div>

      {error && <p className="mt-3 text-xs text-danger font-medium">{error}</p>}

      <div className="mt-5 space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
        {rules.length === 0 ? (
          <div className="py-5 text-center border border-dashed border-border rounded-xl">
            <p className="text-xs text-secondary">Sin flujos guardados</p>
          </div>
        ) : rules.map((rule) => (
          <div key={rule.id} className="flex items-start justify-between gap-3 rounded-xl bg-surface-2 border border-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{rule.name}</p>
              <p className="text-xs text-secondary truncate">{formatRuleSchedule(rule)}</p>
              <p className="text-xs text-secondary/80 truncate">{rule.prompt}</p>
            </div>
            {rule.source !== 'system' && (
              <button
                type="button"
                onClick={() => handleDelete(rule.id)}
                disabled={busy === rule.id}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
              >
                {busy === rule.id ? '...' : 'Eliminar'}
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function parseFlowTarget(selectedTarget: string): { phoneNumber: string | null; label: string; isGroup: boolean } {
  if (selectedTarget.startsWith('contact:')) {
    const phoneNumber = selectedTarget.slice('contact:'.length);
    return { phoneNumber, label: `Contacto +${phoneNumber}`, isGroup: false };
  }
  if (selectedTarget.startsWith('group:')) {
    return { phoneNumber: null, label: 'Grupo', isGroup: true };
  }
  return { phoneNumber: null, label: 'Perfil global', isGroup: false };
}

function matchesTarget(rule: PassiveWorkflowRule, phoneNumber: string | null): boolean {
  const rulePhone = String(rule.phoneNumber || '').replace(/\D/g, '');
  if (!phoneNumber) return !rulePhone;
  return rulePhone === phoneNumber.replace(/\D/g, '');
}

function buildSchedule(
  mode: ScheduleMode,
  date: string,
  time: string,
  customCronExpression: string,
): { cronExpression: string; scheduleLabel: string; runOnce: boolean; scheduledFor: string | null } {
  if (mode === 'custom') {
    const cronExpression = customCronExpression.trim();
    return { cronExpression, scheduleLabel: describeCron(cronExpression), runOnce: false, scheduledFor: null };
  }

  const { hour, minute, label: timeLabel } = parseTime(time);
  if (mode === 'once') {
    const parsedDate = parseDate(date);
    if (!parsedDate) return { cronExpression: '', scheduleLabel: 'Elige una fecha', runOnce: true, scheduledFor: null };
    return {
      cronExpression: `${minute} ${hour} ${parsedDate.day} ${parsedDate.month} *`,
      scheduleLabel: `El ${parsedDate.label} a las ${timeLabel}`,
      runOnce: true,
      scheduledFor: `${parsedDate.inputValue}T${timeLabel}:00`,
    };
  }

  const dayOfWeek = mode === 'daily' ? '*' : mode === 'weekdays' ? '1-5' : mode;
  const label = SCHEDULE_OPTIONS.find((option) => option.value === mode)?.label || 'Todos los dias';
  return {
    cronExpression: `${minute} ${hour} * * ${dayOfWeek}`,
    scheduleLabel: `${label} a las ${timeLabel}`,
    runOnce: false,
    scheduledFor: null,
  };
}

function parseTime(value: string): { hour: number; minute: number; label: string } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  const rawHour = match ? Number(match[1]) : 9;
  const rawMinute = match ? Number(match[2]) : 0;
  const hour = Number.isFinite(rawHour) ? Math.min(Math.max(rawHour, 0), 23) : 9;
  const minute = Number.isFinite(rawMinute) ? Math.min(Math.max(rawMinute, 0), 59) : 0;
  return {
    hour,
    minute,
    label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

function parseDate(value: string): { day: number; month: number; label: string; inputValue: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return {
    day,
    month,
    inputValue: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    label: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`,
  };
}

function formatRuleSchedule(rule: PassiveWorkflowRule): string {
  const label = String(rule.scheduleLabel || '').trim();
  const cronExpression = String(rule.cronExpression || '').trim();
  if (label && label !== cronExpression) return label;
  return describeCron(cronExpression || label);
}

function describeCron(cronExpression: string): string {
  const normalized = String(cronExpression || '').trim();
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) return normalized || 'Sin programacion';

  const [minuteRaw, hourRaw, dayOfMonthRaw, monthRaw, dayOfWeekRaw] = parts;
  if (!/^\d+$/.test(minuteRaw) || !/^\d+$/.test(hourRaw)) return normalized;

  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const weekdayLabels: Record<string, string> = {
    '0': 'Domingo',
    '1': 'Lunes',
    '2': 'Martes',
    '3': 'Miercoles',
    '4': 'Jueves',
    '5': 'Viernes',
    '6': 'Sabado',
    '7': 'Domingo',
  };

  if (/^\d+$/.test(dayOfMonthRaw) && /^\d+$/.test(monthRaw)) {
    return `El ${String(Number(dayOfMonthRaw)).padStart(2, '0')}/${String(Number(monthRaw)).padStart(2, '0')} a las ${timeLabel}`;
  }
  if (dayOfWeekRaw === '*') return `Todos los dias a las ${timeLabel}`;
  if (dayOfWeekRaw === '1-5') return `Lunes a viernes a las ${timeLabel}`;
  return `${weekdayLabels[dayOfWeekRaw] || normalized} a las ${timeLabel}`;
}

function getTodayInputDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
