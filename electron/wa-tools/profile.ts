export const PROFILE_TOOLS = [
  {
    name: 'whatsapp_update_profile',
    description: 'Actualiza y guarda de forma persistente la personalizacion del agente de WhatsApp para el remitente actual. Usala cuando el usuario pida cambiar tu nombre, tono, trato, contexto, instrucciones o comportamiento de flujos.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        displayName: { type: 'STRING' as const, description: 'Nombre con el que el agente debe presentarse para este usuario o grupo.' },
        userAlias: { type: 'STRING' as const, description: 'Forma de dirigirte al usuario: nombre, apodo, tratamiento o vacio para natural.' },
        tone: { type: 'STRING' as const, description: 'professional | warm | emotional_support | direct | custom.' },
        responseStyle: { type: 'STRING' as const, description: 'Estilo de respuesta deseado.' },
        context: { type: 'STRING' as const, description: 'Contexto estable del usuario o grupo que debe recordarse.' },
        customInstructions: { type: 'STRING' as const, description: 'Instrucciones persistentes de comportamiento.' },
        flowInstructions: { type: 'STRING' as const, description: 'Preferencias persistentes para acciones, automatizaciones y flujos.' },
        reset: { type: 'BOOLEAN' as const, description: 'true para reiniciar la personalizacion del perfil actual.' },
      },
    },
  },
];
