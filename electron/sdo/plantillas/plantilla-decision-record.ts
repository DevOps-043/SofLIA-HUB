/**
 * Plantilla A del SDO-AN: registro de decision como vista narrativa.
 * Funcion pura: SdoDecision (+ aprobaciones) → markdown.
 */
import type { SdoApproval, SdoDecision } from '../sdo-types';
import { formatearFecha, lineaEstados, listaEvidencias } from './plantilla-helpers';

export const DECISION_RECORD_TEMPLATE_ID = 'sdo-decision-record';
export const DECISION_RECORD_TEMPLATE_VERSION = '1.0.0';

export function renderDecisionRecord(decision: SdoDecision, approvals: SdoApproval[]): string {
  const lineas: string[] = [
    `# Registro de decision`,
    '',
    `**ID:** ${decision.id}`,
    '',
    lineaEstados(decision),
    '',
  ];

  if (decision.question) {
    lineas.push('## Pregunta que resuelve', '', decision.question, '');
  }

  lineas.push('## Decision', '', decision.statement, '');

  if (decision.context) {
    lineas.push('## Contexto', '', decision.context, '');
  }

  if (decision.consequences) {
    lineas.push('## Consecuencias', '', decision.consequences, '');
  }

  lineas.push(
    '## Autoridad',
    '',
    `- Decision Owner: ${decision.decision_owner ?? 'sin asignar'}`,
    `- Base de autoridad: ${decision.authority_basis ?? 'no registrada'}`,
    `- Aprobada por: ${decision.approved_by_user_id ?? 'pendiente de aprobacion'}`,
    `- Fecha de aprobacion: ${formatearFecha(decision.approved_at)}`,
    '',
    '## Vigencia',
    '',
    `- Vigente desde: ${formatearFecha(decision.valid_from)}`,
    `- Vigente hasta: ${formatearFecha(decision.valid_until)}`,
    `- Proxima revision: ${formatearFecha(decision.review_due)}`,
    decision.supersedes_id ? `- Sustituye a: ${decision.supersedes_id}` : '- No sustituye a ningun registro anterior.',
    '',
    '## Evidencia',
    '',
    ...listaEvidencias(decision.source_refs),
    '',
  );

  if (decision.communication_rule) {
    lineas.push('## Restricciones de comunicacion', '', decision.communication_rule, '');
  }

  if (approvals.length > 0) {
    lineas.push('## Historial de aprobaciones', '');
    for (const approval of approvals) {
      lineas.push(`- ${formatearFecha(approval.decided_at)} — **${approval.decision}** por ${approval.decided_by_user_id}${approval.comment ? `: "${approval.comment}"` : ''}`);
    }
    lineas.push('');
  }

  lineas.push(
    '---',
    '',
    `_Vista generada desde el Registro Operativo Gobernado (plantilla ${DECISION_RECORD_TEMPLATE_ID}@${DECISION_RECORD_TEMPLATE_VERSION}). El documento no confiere autoridad: la autoridad vive en los registros y sus aprobaciones._`,
  );

  return lineas.join('\n');
}
