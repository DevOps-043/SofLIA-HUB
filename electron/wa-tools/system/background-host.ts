export const BACKGROUND_HOST_TOOLS = [
  {
    name: 'get_background_host_status',
    description: 'Obtiene el estado del host en segundo plano de SofLIA: soporte, openAtLogin, schtasks, Startup fallback y modo de instalacion.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'repair_background_host',
    description: 'Repara o reaplica la configuracion del host en segundo plano de SofLIA (login item, schtasks o Startup fallback). REQUIERE confirmacion.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
];
