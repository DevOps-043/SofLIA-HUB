export const IRIS_AUTH_TOOLS = [
  {
    name: 'iris_login',
    description: 'Autentica al usuario de WhatsApp con Project Hub (IRIS). Solo usala cuando el usuario de sus credenciales explicitamente.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        email: { type: 'STRING' as const, description: 'Email o nombre de usuario del sistema SOFIA/Project Hub.' },
        password: { type: 'STRING' as const, description: 'Contrasena del usuario.' },
      },
      required: ['email', 'password'],
    },
  },
  {
    name: 'iris_logout',
    description: 'Cierra la sesion del usuario en Project Hub. Sus datos de IRIS ya no estaran vinculados a su numero de WhatsApp.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
];
