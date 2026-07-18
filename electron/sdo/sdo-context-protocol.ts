/**
 * Protocolo de informacion faltante del SDO-AN.
 *
 * Toda respuesta del agente basada en el registro se estructura en 5 bloques:
 *   1. Confirmado      — corroborado/observado + aprobado + vigente
 *   2. No confirmado   — inferido o propuesto/borrador (sin autoridad)
 *   3. Contradicciones — disputado
 *   4. Pendiente       — pendiente de decision, con la autoridad que decide
 *   5. Restriccion     — reglas de comunicacion y confidencialidad
 *
 * Reglas: desconocido no significa falso; ausencia de evidencia no significa
 * rechazo; un texto generado no completa datos faltantes.
 */
import type { SdoAction, SdoClaim, SdoDecision } from './sdo-types';

export interface SdoConsulta {
  tema: string;
  decisiones: SdoDecision[];
  claims: SdoClaim[];
  acciones: SdoAction[];
}

interface Registro {
  statement: string;
  epistemic?: string;
  authority: string;
  temporal: string;
  owner?: string | null;
  communication_rule?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
}

function normalizar(consulta: SdoConsulta): Registro[] {
  return [
    ...consulta.decisiones.map((d) => ({
      statement: d.statement,
      epistemic: d.epistemic_status,
      authority: d.authority_status,
      temporal: d.temporal_status,
      owner: d.decision_owner,
      communication_rule: d.communication_rule,
      approved_by: d.approved_by_user_id,
      approved_at: d.approved_at,
    })),
    ...consulta.claims.map((c) => ({
      statement: c.statement,
      epistemic: c.epistemic_status,
      authority: c.authority_status,
      temporal: c.temporal_status,
      owner: c.approver_user_id,
      communication_rule: null,
      approved_by: c.approver_user_id,
      approved_at: null,
    })),
  ];
}

export function construirRespuestaProtocolo(consulta: SdoConsulta): string {
  const registros = normalizar(consulta);

  const confirmados = registros.filter(
    (r) => r.authority === 'aprobado' && r.temporal === 'vigente' && (r.epistemic === 'corroborado' || r.epistemic === 'observado' || !r.epistemic),
  );
  const noConfirmados = registros.filter(
    (r) => r.authority === 'propuesto' || r.authority === 'borrador' || (r.authority === 'aprobado' && r.epistemic === 'inferido'),
  );
  const contradicciones = registros.filter((r) => r.epistemic === 'disputado');
  const pendientes = registros.filter((r) => r.authority === 'pendiente');
  const vencidos = registros.filter((r) => r.temporal === 'vencido' || r.temporal === 'reemplazado');
  const restricciones = registros.map((r) => r.communication_rule).filter((r): r is string => Boolean(r));
  const accionesAbiertas = consulta.acciones.filter((a) => a.status === 'abierta' || a.status === 'en_curso' || a.status === 'bloqueada');

  const lineas: string[] = [`*Registro operativo sobre: ${consulta.tema}*`];

  lineas.push('', '*1. Confirmado* (aprobado y vigente):');
  if (confirmados.length === 0) {
    lineas.push('- Nada esta confirmado con autoridad y vigencia sobre este tema.');
  }
  for (const r of confirmados) {
    lineas.push(`- ${r.statement}${r.approved_by ? ` (aprobado por ${r.approved_by}${r.approved_at ? ` el ${r.approved_at.slice(0, 10)}` : ''})` : ''}`);
  }

  lineas.push('', '*2. No confirmado* (mencionado sin autoridad o inferido — NO comunicar como hecho):');
  if (noConfirmados.length === 0) {
    lineas.push('- Sin registros propuestos o inferidos.');
  }
  for (const r of noConfirmados) {
    lineas.push(`- [${r.authority}${r.epistemic ? `/${r.epistemic}` : ''}] ${r.statement}`);
  }

  lineas.push('', '*3. Contradicciones:*');
  if (contradicciones.length === 0 && vencidos.length === 0) {
    lineas.push('- No hay contradicciones registradas.');
  }
  for (const r of contradicciones) {
    lineas.push(`- [disputado] ${r.statement}`);
  }
  for (const r of vencidos) {
    lineas.push(`- [${r.temporal}] ${r.statement} — ya no es la version vigente.`);
  }

  lineas.push('', '*4. Pendiente* (que decision falta y de quien):');
  if (pendientes.length === 0 && accionesAbiertas.length === 0) {
    lineas.push('- Sin pendientes registrados.');
  }
  for (const r of pendientes) {
    lineas.push(`- ${r.statement} — decide: *${r.owner || 'autoridad sin asignar'}*`);
  }
  for (const a of accionesAbiertas.slice(0, 5)) {
    lineas.push(`- Accion [${a.status}]: ${a.description} — responsable: ${a.responsible || 'sin asignar'}${a.due_date ? `, vence ${a.due_date.slice(0, 10)}` : ''}`);
  }

  lineas.push('', '*5. Restriccion:*');
  for (const restriccion of restricciones) {
    lineas.push(`- ${restriccion}`);
  }
  lineas.push('- No presentar lo propuesto/pendiente como confirmado ni comprometerlo con terceros.');

  return lineas.join('\n');
}
