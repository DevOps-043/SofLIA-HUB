/**
 * Helpers compartidos de las plantillas del SDO.
 * Las plantillas son funciones puras: registros → markdown. El renderizado
 * a DOCX/PDF lo hace document-designer; la autoridad la dan las aprobaciones.
 */
import type { SdoSourceRef } from '../sdo-types';

export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

export function lineaEstados(registro: {
  epistemic_status?: string;
  authority_status: string;
  temporal_status: string;
}): string {
  const partes = [
    registro.epistemic_status ? `Epistemico: **${registro.epistemic_status}**` : null,
    `Autoridad: **${registro.authority_status}**`,
    `Vigencia: **${registro.temporal_status}**`,
  ].filter(Boolean);
  return partes.join(' · ');
}

export function listaEvidencias(refs: SdoSourceRef[] | undefined): string[] {
  if (!refs || refs.length === 0) return ['- Sin evidencia registrada (tratar como inferido).'];
  return refs.map((ref) => {
    const locator = ref.locator ? ` [${ref.locator.tipo} ${ref.locator.valor}]` : '';
    const evidencia = ref.evidence_id ? ` (evidencia ${ref.evidence_id})` : '';
    const cita = ref.excerpt ? `"${ref.excerpt}"` : 'Referencia sin cita';
    return `- ${cita}${locator}${evidencia}`;
  });
}
