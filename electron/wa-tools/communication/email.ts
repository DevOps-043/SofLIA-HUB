export const EMAIL_TOOLS = [
  {
    name: 'get_email_config',
    description: 'Verifica si el email esta configurado para enviar correos.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'configure_email',
    description: 'Configura el email. Solo necesita email y contrasena de aplicacion. El SMTP se detecta automaticamente.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        email: { type: 'STRING' as const, description: 'Email del usuario.' },
        password: { type: 'STRING' as const, description: 'Contrasena de aplicacion.' },
      },
      required: ['email', 'password'],
    },
  },
  {
    name: 'send_email',
    description: 'Envia un email con texto y/o archivos adjuntos. Requiere confirmacion del usuario.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        to: { type: 'STRING' as const, description: 'Email del destinatario.' },
        subject: { type: 'STRING' as const, description: 'Asunto.' },
        body: { type: 'STRING' as const, description: 'Cuerpo del email.' },
        attachment_paths: { type: 'ARRAY' as const, items: { type: 'STRING' as const }, description: 'Rutas de archivos a adjuntar.' },
        is_html: { type: 'BOOLEAN' as const, description: 'Si el body es HTML.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
];
