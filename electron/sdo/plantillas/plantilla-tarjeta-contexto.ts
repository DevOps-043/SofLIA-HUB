/**
 * Plantilla F del SDO-AN: tarjeta de contexto vigente sobre un sujeto.
 * Muestra SOLO: que esta vigente, que cambio, que esta pendiente, quien
 * decide, proxima accion, riesgos, restricciones, fecha de verificacion
 * y evidencias.
 */
import type { SdoAction, SdoClaim, SdoDecision } from '../sdo-types';
import { formatearFecha } from './plantilla-helpers';

export const TARJETA_TEMPLATE_ID = 'sdo-tarjeta-contexto';
export const TARJETA_TEMPLATE_VERSION = '1.0.0';

export interface TarjetaContextoInput {
  sujeto: string;
  decisiones: SdoDecision[];
  claims: SdoClaim[];
  acciones: SdoAction[];
  verificadoEn: string;
}

export function renderTarjetaContexto(input: TarjetaContextoInput): string {
  const vigentes = input.decisiones.filter((d) => d.temporal_status === 'vigente' && d.authority_status === 'aprobado');
  const reemplazadas = input.decisiones.filter((d) => d.temporal_status === 'reemplazado' || d.temporal_status === 'vencido');
  const pendientes = input.decisiones.filter((d) => ['propuesto', 'pendiente', 'borrador'].includes(d.authority_status));
  const riesgos = input.claims.filter((c) => c.claim_type === 'riesgo' && c.temporal_status !== 'archivado');
  const accionesAbiertas = input.acciones.filter((a) => a.status === 'abierta' || a.status === 'en_curso' || a.status === 'bloqueada');
  const restricciones = vigentes.map((d) => d.communication_rule).filter((r): r is string => Boolean(r));

  const lineas: string[] = [
    `# Tarjeta de contexto: ${input.sujeto}`,
    '',
    `**Verificado el:** ${formatearFecha(input.verificadoEn)}`,
    '',
    '## Vigente',
    '',
  ];

  if (vigentes.length === 0) {
    lineas.push('No hay decisiones aprobadas y vigentes sobre este sujeto.', '');
  }
  for (const decision of vigentes) {
    lineas.push(`- ${decision.statement} _(aprobada ${formatearFecha(decision.approved_at)}, vence ${formatearFecha(decision.valid_until)})_`);
  }
  if (vigentes.length > 0) lineas.push('');

  if (reemplazadas.length > 0) {
    lineas.push('## Que cambio', '');
    for (const decision of reemplazadas) {
      lineas.push(`- [${decision.temporal_status}] ${decision.statement}`);
    }
    lineas.push('');
  }

  lineas.push('## Pendiente y quien decide', '');
  if (pendientes.length === 0) {
    lineas.push('Sin decisiones pendientes registradas.', '');
  }
  for (const decision of pendientes) {
    lineas.push(`- [${decision.authority_status}] ${decision.statement} — decide: **${decision.decision_owner ?? 'autoridad sin asignar'}**`);
  }
  if (pendientes.length > 0) lineas.push('');

  lineas.push('## Proxima accion', '');
  if (accionesAbiertas.length === 0) {
    lineas.push('Sin acciones abiertas.', '');
  }
  for (const accion of accionesAbiertas.slice(0, 5)) {
    lineas.push(`- [${accion.status}] ${accion.description} — ${accion.responsible ?? 'sin responsable'}, vence ${formatearFecha(accion.due_date)}`);
  }
  if (accionesAbiertas.length > 0) lineas.push('');

  if (riesgos.length > 0) {
    lineas.push('## Riesgos', '');
    for (const riesgo of riesgos.slice(0, 5)) {
      lineas.push(`- [${riesgo.epistemic_status}/${riesgo.authority_status}] ${riesgo.statement}`);
    }
    lineas.push('');
  }

  lineas.push('## Restricciones de comunicacion', '');
  if (restricciones.length === 0) {
    lineas.push('- No comunicar como confirmado nada que aparezca como propuesto o pendiente.');
  } else {
    for (const restriccion of restricciones) lineas.push(`- ${restriccion}`);
    lineas.push('- No comunicar como confirmado nada que aparezca como propuesto o pendiente.');
  }

  lineas.push(
    '',
    '---',
    '',
    `_Vista generada desde el Registro Operativo Gobernado (plantilla ${TARJETA_TEMPLATE_ID}@${TARJETA_TEMPLATE_VERSION})._`,
  );

  return lineas.join('\n');
}
