/**
 * Herramientas del agente para el Registro Operativo Gobernado (SDO).
 *
 * REGLA DE GOBIERNO: no existe `sdo_approve`. La IA puede consultar y
 * proponer; solo un humano aprueba (desde la UI del Hub).
 */
export const SDO_TOOLS = [
  {
    name: 'sdo_query',
    description:
      'Consulta el Registro Operativo Gobernado (decisiones, riesgos, acciones) sobre un tema. Devuelve la respuesta en 5 bloques: confirmado, no confirmado, contradicciones, pendiente y restricciones. Usala antes de afirmar que algo esta decidido o aprobado.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        tema: { type: 'STRING' as const, description: 'Tema, persona, proyecto o cliente a consultar.' },
        solo_vigentes: { type: 'BOOLEAN' as const, description: 'Si true, solo registros aprobados y vigentes.' },
      },
      required: ['tema'],
    },
  },
  {
    name: 'sdo_propose',
    description:
      'Propone un registro nuevo en el Registro Operativo Gobernado (decision, riesgo, hecho o compromiso). Queda como PROPUESTO: un humano debe aprobarlo desde el Hub antes de ser oficial. Nunca lo presentes como aprobado.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        tipo: {
          type: 'STRING' as const,
          description: 'Tipo de registro: decision | riesgo | hecho | compromiso.',
        },
        statement: { type: 'STRING' as const, description: 'Enunciado claro del registro propuesto.' },
        subject: { type: 'STRING' as const, description: 'Sujeto del registro (persona, proyecto, cliente).' },
        decision_owner: { type: 'STRING' as const, description: 'Quien tiene autoridad para decidir (si aplica).' },
      },
      required: ['tipo', 'statement'],
    },
  },
];
