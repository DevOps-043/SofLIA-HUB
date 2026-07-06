import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { getCommunicationHub } from '../../services/communication-hub-service';

type Actor = { userId?: string | null; organizationId?: string | null };
type Provider = 'whatsapp' | 'telegram';

const TEMPLATES = [
  {
    id: 'incident',
    label: 'Incidente',
    text: '[Incidente] {{titulo}}\nImpacto: {{impacto}}\nResponsable: {{responsable}}\nSiguiente accion: {{accion}}',
  },
  {
    id: 'approval',
    label: 'Aprobacion',
    text: 'Solicitud de aprobacion\nCaso: {{caso}}\nDecision requerida: {{decision}}\nLimite: {{fecha_limite}}',
  },
  {
    id: 'survey',
    label: 'Encuesta',
    text: 'Pulso interno: {{tema}}\nResponde con 1-5 y un comentario breve.\nCierre: {{cierre}}',
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    text: 'Bienvenido/a {{nombre}}. Tus primeros pasos de hoy:\n1. {{paso_1}}\n2. {{paso_2}}\n3. {{paso_3}}',
  },
  {
    id: 'crm',
    label: 'CRM intake',
    text: 'Nuevo lead: {{empresa}}\nContacto: {{contacto}}\nNecesidad: {{necesidad}}\nProxima accion: {{accion}}',
  },
  {
    id: 'kpi',
    label: 'KPI',
    text: 'Seguimiento KPI\nMetrica: {{metrica}}\nActual: {{actual}}\nMeta: {{meta}}\nRiesgo: {{riesgo}}',
  },
  {
    id: 'reminder',
    label: 'Recordatorio',
    text: 'Recordatorio: {{actividad}}\nHora: {{hora}}\nPrioridad: {{prioridad}}',
  },
];

const SEGMENTS = [
  { id: 'organization', label: 'Organizacion' },
  { id: 'team', label: 'Equipo' },
  { id: 'role', label: 'Rol' },
  { id: 'user', label: 'Usuario' },
  { id: 'group', label: 'Grupo' },
];

interface OrganizationChannelConsoleCardProps {
  actor: Actor;
  defaultRecipient: string;
}

export function OrganizationChannelConsoleCard({ actor, defaultRecipient }: OrganizationChannelConsoleCardProps) {
  const [provider, setProvider] = useState<Provider>('whatsapp');
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [segment, setSegment] = useState('organization');
  const [message, setMessage] = useState(TEMPLATES[0].text);
  const [scheduledAt, setScheduledAt] = useState('');
  const [dailyLimit, setDailyLimit] = useState(250);
  const [requirePreview, setRequirePreview] = useState(true);
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRecipient((current) => current || defaultRecipient);
  }, [defaultRecipient]);

  useEffect(() => {
    if (!window.communicationHub) return;
    void getCommunicationHub().getOrgStatus(actor).then((result) => {
      const policy = result.policy as { campaigns?: { dailyLimit?: number; requirePreview?: boolean } } | undefined;
      if (policy?.campaigns?.dailyLimit) setDailyLimit(policy.campaigns.dailyLimit);
      if (typeof policy?.campaigns?.requirePreview === 'boolean') setRequirePreview(policy.campaigns.requirePreview);
    });
  }, [actor]);

  const canSend = useMemo(() => Boolean(recipient.trim() && message.trim()), [message, recipient]);

  const applyTemplate = (templateText: string) => {
    setMessage(templateText);
    setPreview('');
    setStatus(null);
  };

  const handlePreview = () => {
    setPreview(message.replace(/\{\{([^}]+)\}\}/g, (_match, key) => `[${String(key).trim()}]`));
    setStatus(null);
  };

  const handleSavePolicy = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await getCommunicationHub().updatePolicy(actor, {
        campaigns: { dailyLimit, requirePreview },
      });
      setStatus(result.success ? 'Politica guardada.' : String(result.error || 'No se pudo guardar la politica.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    if (requirePreview && !preview) {
      setStatus('Genera una vista previa antes de enviar.');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const result = await getCommunicationHub().sendMessage({
        actor,
        provider,
        scope: 'organization',
        recipient,
        text: message,
        metadata: { segment },
      });
      setStatus(result.success ? 'Mensaje enviado.' : String(result.error || 'No se pudo enviar.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSchedule = async () => {
    if (!canSend || !scheduledAt) return;
    if (requirePreview && !preview) {
      setStatus('Genera una vista previa antes de programar.');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const result = await getCommunicationHub().scheduleMessage({
        actor,
        provider,
        scope: 'organization',
        recipient,
        text: message,
        scheduledAt,
        metadata: { segment },
      });
      setStatus(result.success ? 'Mensaje programado.' : String(result.error || 'No se pudo programar.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Consola Organizacional</h3>
          <p className="mt-1 text-xs text-secondary">Campanas, recordatorios, incidentes, aprobaciones y seguimiento operativo.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={provider === 'whatsapp' ? 'primary' : 'secondary'} size="sm" onClick={() => setProvider('whatsapp')}>
            WhatsApp
          </Button>
          <Button variant={provider === 'telegram' ? 'primary' : 'secondary'} size="sm" onClick={() => setProvider('telegram')}>
            Telegram
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <input
              type="text"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={provider === 'whatsapp' ? '521... o grupo@g.us' : 'chat_id'}
              className="min-w-0 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-colors placeholder-secondary/70 focus:border-accent focus:ring-2 focus:ring-accent/15 dark:text-white"
            />
            <select
              value={segment}
              onChange={(event) => setSegment(event.target.value)}
              className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 dark:text-white"
            >
              {SEGMENTS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>

          <textarea
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setPreview('');
            }}
            rows={7}
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-3 text-sm text-gray-900 outline-none transition-colors placeholder-secondary/70 focus:border-accent focus:ring-2 focus:ring-accent/15 dark:text-white"
          />

          {preview && (
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-secondary">Vista previa</p>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-gray-300">{preview}</pre>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="min-w-0 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 dark:text-white"
            />
            <Button variant="secondary" size="sm" onClick={handlePreview} disabled={!message.trim()}>
              Vista previa
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSchedule} disabled={busy || !canSend || !scheduledAt}>
              Programar
            </Button>
            <Button variant="primary" size="sm" onClick={handleSend} disabled={busy || !canSend}>
              Enviar
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.text)}
                className="min-h-9 rounded-xl border border-border bg-surface-2 px-3 text-left text-xs font-medium text-secondary transition-colors hover:border-accent/30 hover:text-gray-900 dark:hover:text-white"
              >
                {template.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-secondary">Limite diario</label>
            <input
              type="number"
              min={1}
              max={5000}
              value={dailyLimit}
              onChange={(event) => setDailyLimit(Number(event.target.value) || 1)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent dark:text-white"
            />
            <label className="mt-3 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={requirePreview}
                onChange={(event) => setRequirePreview(event.target.checked)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              Requiere vista previa
            </label>
            <Button variant="secondary" size="sm" onClick={handleSavePolicy} disabled={busy} className="mt-3 w-full">
              Guardar politica
            </Button>
          </div>
        </div>
      </div>

      {status && (
        <div className="mt-4 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-secondary">
          {status}
        </div>
      )}
    </Card>
  );
}
