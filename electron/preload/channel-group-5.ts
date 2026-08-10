export const CHANNEL_GROUP_5 = [
  'integrated-browser:history-list',
  'integrated-browser:history-clear',
  'integrated-browser:credentials-list',
  'integrated-browser:credentials-save',
  'integrated-browser:credentials-fill',
  'integrated-browser:credentials-remove',
  'integrated-browser:extensions-list',
  'integrated-browser:extensions-install',
  'integrated-browser:extensions-confirm-install',
  'integrated-browser:extensions-set-enabled',
  'integrated-browser:extensions-remove',
  // Permisos por sitio del navegador: el renderer los lee y los cambia, pero
  // conceder camara o microfono sigue pasando por el gate del sistema en main.
  'integrated-browser:site-permissions-get',
  'integrated-browser:site-permissions-set',
  'integrated-browser:site-permissions-reset',
  'integrated-browser:site-permissions-changed',
  // Resúmenes de pestañas: el compositor del chat lee título, url y texto DOM
  // de cada pestaña para adjuntarlas como contexto a la conversación.
  'integrated-browser:tab-summaries',
  'integrated-browser:get-tab-content',

  // Espacio de trabajo de Skills: operaciones acotadas al workspace activo.
  // Ninguna de ellas acepta rutas absolutas ni devuelve rutas del disco.
  'skill-workspace:create',
  'skill-workspace:find-by-conversation',
  'skill-workspace:get-state',
  'skill-workspace:read-file',
  'skill-workspace:write-file',
  'skill-workspace:edit-file',
  'skill-workspace:delete-file',
  'skill-workspace:open-folder',
  'skill-workspace:delete',
  'skill-workspace:progress',
  'skill-workspace:preview-url',
  'skill-workspace:write-image',
  'skill-workspace:download-image',

  // Presentaciones: vista a pantalla completa y exportacion.
  'presentation-view:open',
  'presentation-view:close',
  'presentation-view:closed',
  'presentation:export-html',
  'presentation:prepare-branding',
] as const;
