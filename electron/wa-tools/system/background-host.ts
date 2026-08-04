export const BACKGROUND_HOST_TOOLS = [
  {
    name: 'get_background_host_status',
    description: 'Obtiene el estado del host en segundo plano de SofLIA: soporte, login item, schtasks/Startup en Windows, XDG Autostart en Linux y modo de instalacion.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'repair_background_host',
    description: 'Repara o reaplica la configuracion del host en segundo plano de SofLIA (login item, schtasks/Startup en Windows o XDG Autostart en Linux). REQUIERE confirmacion.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
];
