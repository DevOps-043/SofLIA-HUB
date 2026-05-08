import { useEffect, useState } from 'react';
import './window-proactive';
import { toProactiveUpdates } from './settings-builders';
import type { ProactiveConfigState } from './types';

export function useProactiveConfig(isOpen: boolean): ProactiveConfigState {
  const [proactiveEnabled, setProactiveEnabled] = useState(true);
  const [notifHours, setNotifHours] = useState<number[]>([8, 20]);
  const [calendarReminders, setCalendarReminders] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [proactiveTesting, setProactiveTesting] = useState(false);
  const [proactiveTestResult, setProactiveTestResult] = useState('');
  const available = typeof window !== 'undefined' && !!window.proactive;

  useEffect(() => {
    if (!isOpen || !window.proactive) return;
    window.proactive.getConfig().then((config: any) => {
      setProactiveEnabled(config.enabled ?? true);
      setNotifHours(config.notificationHours ?? [8, 20]);
      setCalendarReminders(config.calendarReminders ?? true);
      setTaskReminders(config.taskReminders ?? true);
      setSystemAlerts(config.systemAlerts ?? true);
    }).catch(() => {});
  }, [isOpen]);

  const saveConfig = async () => {
    if (!window.proactive) return;
    await window.proactive.updateConfig(toProactiveUpdates({
      proactiveEnabled,
      notifHours,
      calendarReminders,
      taskReminders,
      systemAlerts,
    }));
  };

  const testNotification = async () => {
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

  return {
    available,
    proactiveEnabled,
    notifHours,
    calendarReminders,
    taskReminders,
    systemAlerts,
    proactiveTesting,
    proactiveTestResult,
    setProactiveEnabled,
    setCalendarReminders,
    setTaskReminders,
    setSystemAlerts,
    toggleHour: (hour: number) => setNotifHours((prev) =>
      prev.includes(hour) ? prev.filter((item) => item !== hour) : [...prev, hour].sort((a, b) => a - b),
    ),
    testNotification,
    saveConfig,
  };
}
