export const FILE_DELIVERY_TOOLS = [
  {
    name: 'whatsapp_send_file',
    description: 'Envia un archivo de la computadora al usuario directamente por WhatsApp. Usa esto cuando el usuario pida que le envies un archivo.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        file_path: { type: 'STRING' as const, description: 'Ruta completa del archivo a enviar.' },
        caption: { type: 'STRING' as const, description: 'Texto que acompana al archivo.' },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'save_whatsapp_file',
    description: 'Copia un archivo recibido por WhatsApp a una ubicacion elegida por el usuario en su computadora.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        source_path: { type: 'STRING' as const, description: 'Ruta del archivo temporal proporcionada en el contexto del mensaje recibido.' },
        destination_path: { type: 'STRING' as const, description: 'Ruta completa donde guardar el archivo.' },
      },
      required: ['source_path', 'destination_path'],
    },
  },
  {
    name: 'take_screenshot_and_send',
    description: 'Toma capturas de pantalla de todos los monitores de la computadora y las envia al usuario por WhatsApp.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        monitor_index: { type: 'NUMBER' as const, description: 'Indice del monitor especifico. Si se omite, captura todos los monitores.' },
      },
    },
  },
  {
    name: 'send_voice_note',
    description: 'Responde al usuario con una nota de voz hablada en lugar de texto. Usala cuando el usuario pida que le hables, que le respondas con audio, o cuando estes en modo llamada y la respuesta se entienda mejor dicha. No la uses para textos largos, listas ni codigo: eso se lee mejor escrito.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        text: { type: 'STRING' as const, description: 'Lo que vas a decir, en lenguaje hablado natural y sin formato Markdown.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'whatsapp_send_to_contact',
    description: 'Envia un mensaje de texto y/o archivo a otro numero de WhatsApp. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        phone_number: { type: 'STRING' as const, description: 'Numero de telefono del destinatario con codigo de pais.' },
        message: { type: 'STRING' as const, description: 'Mensaje de texto a enviar. Opcional si se envia archivo.' },
        file_path: { type: 'STRING' as const, description: 'Ruta del archivo a enviar. Opcional si se envia solo texto.' },
        caption: { type: 'STRING' as const, description: 'Texto que acompana al archivo. Solo aplica si se envia archivo.' },
      },
      required: ['phone_number'],
    },
  },
];
