/** Helpers visuales del Registro Operativo Gobernado (chips de estados). */
import type { SdoAuthorityStatus, SdoEpistemicStatus, SdoTemporalStatus } from '../../services/sdo-service';

export const AUTHORITY_LABELS: Record<SdoAuthorityStatus, string> = {
  borrador: 'Borrador',
  propuesto: 'Propuesto',
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
};

export const TEMPORAL_LABELS: Record<SdoTemporalStatus, string> = {
  futuro: 'Futuro',
  vigente: 'Vigente',
  reemplazado: 'Reemplazado',
  vencido: 'Vencido',
  archivado: 'Archivado',
};

export const EPISTEMIC_LABELS: Record<SdoEpistemicStatus, string> = {
  observado: 'Observado',
  corroborado: 'Corroborado',
  inferido: 'Inferido',
  disputado: 'Disputado',
  desconocido: 'Desconocido',
};

export function authorityChipClass(status: SdoAuthorityStatus): string {
  switch (status) {
    case 'aprobado':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'rechazado':
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
    case 'pendiente':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    case 'propuesto':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-white/60';
  }
}

export function temporalChipClass(status: SdoTemporalStatus): string {
  switch (status) {
    case 'vigente':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'vencido':
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
    case 'reemplazado':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-white/60';
  }
}

export function epistemicChipClass(status: SdoEpistemicStatus): string {
  switch (status) {
    case 'observado':
    case 'corroborado':
      return 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300';
    case 'disputado':
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
    case 'inferido':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-white/60';
  }
}

export function formatearFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}
