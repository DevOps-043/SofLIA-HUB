import { useState } from 'react';
import type { DailySummary, ActivityLog } from '../../../core/entities/ActivityLog';
import { generateSummaryForSession, sendSummaryViaWhatsApp } from '../../../services/monitoring-service';

type SummaryActionProps = {
  summary: DailySummary | null;
  userId: string;
  logs: ActivityLog[];
  selectedDate: string;
  onSummaryGenerated: (summary: DailySummary) => void;
};

export function useSummaryActions({
  summary,
  userId,
  logs,
  selectedDate,
  onSummaryGenerated,
}: SummaryActionProps) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleGenerate = async () => {
    if (logs.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateSummaryForSession(
        userId,
        '',
        logs,
        { startedAt: `${selectedDate}T00:00:00Z`, triggerType: 'manual' },
      );
      onSummaryGenerated({
        userId,
        date: selectedDate,
        totalTimeSeconds: result.totalTimeSeconds || 0,
        productiveTimeSeconds: result.productiveTimeSeconds || 0,
        unproductiveTimeSeconds: 0,
        idleTimeSeconds: result.idleTimeSeconds || 0,
        topApps: result.topApps || [],
        aiSummary: result.summaryText,
        projectsDetected: result.projectsDetected?.map((name: string) => ({
          projectId: '',
          projectName: name,
          timeSeconds: 0,
        })) || [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!summary?.aiSummary) return;
    setSending(true);
    setError(null);
    try {
      if (!window.whatsApp) throw new Error('Servicio de WhatsApp no disponible en este entorno.');
      const waStatus = await window.whatsApp.getStatus();
      const phoneNumber = waStatus?.phoneNumber || '';
      if (!phoneNumber) throw new Error('No se detecto un numero de WhatsApp activo. Esta conectado?');
      await sendSummaryViaWhatsApp(phoneNumber, `*Resumen de Productividad - ${selectedDate}*\n\n${summary.aiSummary}`);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return { error, generating, handleGenerate, handleSendWhatsApp, sending, sent };
}
