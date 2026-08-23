export const CHANNEL_GROUP_5 = [
  'integrated-browser:history-list',
  'integrated-browser:history-clear',
  // Borrado de datos de navegacion del perfil activo, equivalente al de Chrome.
  'integrated-browser:clear-browsing-data',
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
  // Aviso de permiso: main pide la decision y el renderer la responde. La
  // concesion se sigue guardando y aplicando en main.
  'integrated-browser:permission-prompt',
  'integrated-browser:permission-decide',
  // Resúmenes de pestañas: el compositor del chat lee título, url y texto DOM
  // de cada pestaña para adjuntarlas como contexto a la conversación.
  'integrated-browser:tab-summaries',
  'integrated-browser:get-tab-content',

  // Contexto de aplicaciones de escritorio: el chat lista las ventanas abiertas
  // y extrae el contenido de las que el usuario marca. Ambas son de lectura y
  // ninguna captura nada sin una seleccion explicita en el selector.
  'desktop-context:list-apps',
  'desktop-context:capture-app',

  // Espacio de trabajo de Skills: operaciones acotadas al workspace activo.
  // Ninguna de ellas acepta rutas absolutas ni devuelve rutas del disco.
  'skill-workspace:create',
  'skill-workspace:find-by-conversation',
  'skill-workspace:attach-conversation',
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

  // Project Hub: métodos de dominio; ningún token ni cliente Supabase cruza al renderer.
  'project-hub:status',
  'project-hub:retry-auth',
  'project-hub:list-projects',
  'project-hub:create-project',
  'project-hub:get-project',
  'project-hub:update-project',
  'project-hub:list-tasks',
  'project-hub:create-task',
  'project-hub:update-task',
  'project-hub:list-members',
  'project-hub:add-member',
  'project-hub:update-member',
  'project-hub:remove-member',
  'project-hub:list-evidence',
  'project-hub:get-evidence',
  'project-hub:add-evidence',
  'project-hub:get-analytics',
  'project-hub:create-browser-collection',
  'project-hub:import-meeting',
  'project-hub:create-upload-intent',
  'project-hub:complete-upload',
  'project-hub:get-download',
] as const;
