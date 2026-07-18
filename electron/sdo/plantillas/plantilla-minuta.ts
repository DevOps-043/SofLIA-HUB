/**
 * Plantilla C del SDO-AN: minuta estructurada como vista.
 * Separa explicitamente decisiones (aprobadas) de propuestas y riesgos:
 * una minuta no convierte una conversacion en decision.
 */
import type { SdoAction, SdoClaim, SdoDecision } from '../sdo-types';
import { formatearFecha, listaEvidencias } from './plantilla-helpers';

export const MINUTA_TEMPLATE_ID = 'sdo-minuta';
export const MINUTA_TEMPLATE_VERSION = '1.0.0';

export interface MinutaInput {
  titulo: string;
  fecha: string | null;
  decisiones: SdoDecision[];
  acciones: SdoAction[];
  riesgos: SdoClaim[];
}

export function renderMinuta(input: MinutaInput): string {
  const lineas: string[] = [
    `# Minuta: ${input.titulo}`,
    '',
    `**Fecha:** ${formatearFecha(input.fecha)}`,
    '',
  ];

  const aprobadas = input.decisiones.filter((d) => d.authority_status === 'aprobado');
  const noAprobadas = input.decisiones.filter((d) => d.authority_status !== 'aprobado');

  lineas.push('## Decisiones aprobadas', '');
  if (aprobadas.length === 0) {
    lineas.push('No hay decisiones aprobadas registradas para esta reunion.', '');
  }
  for (const decision of aprobadas) {
    lineas.push(
      `### ${decision.statement}`,
      '',
      `- Aprobada por: ${decision.approved_by_user_id ?? '—'} (${formatearFecha(decision.approved_at)})`,
      `- Decision Owner: ${decision.decision_owner ?? 'sin asignar'}`,
      ...listaEvidencias(decision.source_refs),
      '',
    );
  }

  if (noAprobadas.length > 0) {
    lineas.push('## Propuestas y pendientes de aprobacion', '', '_Lo siguiente NO esta aprobado; no debe comunicarse como decidido._', '');
    for (const decision of noAprobadas) {
      lineas.push(`- [${decision.authority_status}] ${decision.statement}`);
    }
    lineas.push('');
  }

  lineas.push('## Acciones', '');
  if (input.acciones.length === 0) {
    lineas.push('Sin acciones registradas.', '');
  }
  for (const accion of input.acciones) {
    const destino = accion.external_ref ? ` → ${accion.external_ref}` : '';
    lineas.push(`- [${accion.status}] ${accion.description} — responsable: ${accion.responsible ?? 'sin asignar'}, vence: ${formatearFecha(accion.due_date)}${destino}`);
  }
  lineas.push('');

  if (input.riesgos.length > 0) {
    lineas.push('## Riesgos detectados (propuestos, requieren revision)', '');
    for (const riesgo of input.riesgos) {
      lineas.push(`- [${riesgo.epistemic_status}] ${riesgo.statement}`);
    }
    lineas.push('');
  }

  lineas.push(
    '---',
    '',
    `_Vista generada desde el Registro Operativo Gobernado (plantilla ${MINUTA_TEMPLATE_ID}@${MINUTA_TEMPLATE_VERSION})._`,
  );

  return lineas.join('\n');
}
