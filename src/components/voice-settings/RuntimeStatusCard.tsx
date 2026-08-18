import { useState } from 'react';

import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { SectionHeader } from '../ui/SectionHeader';
import { cn } from '../ui/cn';
import type { VoicePassivePanel } from './useVoicePassivePanel';

const SETUP_COMMAND = 'npm run python:setup';

/**
 * Diagnostico del pipeline local: runtime Python, modelo Vosk y escucha. Es lo
 * primero que se lee cuando "la voz no funciona", asi que cada fila dice estado
 * y siguiente paso, no solo un punto de color (accesibilidad: icono + texto).
 */
export function RuntimeStatusCard({ panel }: { panel: VoicePassivePanel }) {
  const { status, modelInstalled } = panel;
  const runtimeReady = Boolean(status?.runtimeAvailable);

  return (
    <Card className="space-y-4">
      <SectionHeader
        title="Estado del pipeline local"
        subtitle="Todo se ejecuta en tu equipo: sin runtime no hay escucha ni dictado."
        icon={<ChipIcon className="w-4.5 h-4.5" />}
        action={(
          <Badge tone={runtimeReady && modelInstalled ? 'success' : 'warning'}>
            {runtimeReady && modelInstalled ? 'Listo' : 'Incompleto'}
          </Badge>
        )}
      />

      <div className="rounded-2xl border border-border bg-surface-2 divide-y divide-border">
        <StatusRow
          label="Runtime Python"
          state={runtimeReady ? 'ok' : 'pending'}
          okText="Instalado"
          pendingText="No instalado"
          detail={runtimeReady ? undefined : status?.pythonPath}
        />
        <StatusRow
          label="Modelo de voz (español)"
          state={modelInstalled ? 'ok' : 'pending'}
          okText={status?.largeModelInstalled ? 'Grande — máxima precisión' : 'Small — precisión estándar'}
          pendingText="Pendiente de descarga (~39 MB)"
        />
        <StatusRow
          label="Escucha pasiva"
          state={status?.listening ? 'ok' : 'idle'}
          okText="Activa"
          pendingText="Inactiva"
        />
      </div>

      {!runtimeReady && (
        <div className="rounded-2xl border border-warning/25 bg-warning/[0.07] p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <WarningIcon className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
            <div className="text-xs leading-relaxed text-gray-900 dark:text-white">
              <p className="font-medium">Falta el runtime de Python.</p>
              <p className="text-secondary mt-0.5">
                Viene incluido en el instalador: reinstala Pulse Hub o, si trabajas desde el
                repositorio, genera el runtime con este comando en la raíz del proyecto.
              </p>
            </div>
          </div>
          <CommandRow command={SETUP_COMMAND} />
        </div>
      )}

      {status?.lastError && (
        <div className="rounded-2xl border border-danger/25 bg-danger/[0.06] p-3.5 flex items-start gap-2.5">
          <ErrorIcon className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-danger">Último error</p>
            <p className="text-xs text-secondary mt-0.5 break-words">{status.lastError}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function StatusRow({ label, state, okText, pendingText, detail }: {
  label: string;
  state: 'ok' | 'pending' | 'idle';
  okText: string;
  pendingText: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-gray-900 dark:text-white">{label}</p>
        {detail && (
          <p className="text-[11px] font-mono text-secondary mt-0.5 truncate" title={detail}>{detail}</p>
        )}
      </div>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium shrink-0',
          state === 'ok' ? 'text-success' : state === 'pending' ? 'text-warning' : 'text-secondary',
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            state === 'ok' ? 'bg-success' : state === 'pending' ? 'bg-warning' : 'bg-secondary/50',
          )}
        />
        {state === 'ok' ? okText : pendingText}
      </span>
    </div>
  );
}

function CommandRow({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      <code className="flex-1 text-[11px] font-mono text-gray-900 dark:text-white truncate">{command}</code>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 text-[11px] font-medium text-accent hover:underline focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15 rounded px-1"
      >
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

function ChipIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="7" y="7" width="10" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </svg>
  );
}

function WarningIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}

function ErrorIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 8v4.5M12 16h.01" />
    </svg>
  );
}
