## Decisiones
La instancia SOFIA Learning tiene SELECT para authenticated sobre organizations, pero no UPDATE. Se usa una función SECURITY DEFINER con search_path fijo, auth.uid(), membresía administrativa activa y allowlist cerrada. Sólo authenticated puede invocarla. No se amplían los permisos de las tablas compartidas.

La carga usa un bucket nuevo organization-branding, archivos inmutables con UUID y prefijo de organización. Una política restrictiva protege ese bucket incluso frente a la política permisiva preexistente live_recordings_server_only (ALL para anon/authenticated salvo live-recordings). No se modifican otros buckets. El contenido gráfico es público por diseño; las escrituras son administrativas.

El formulario guarda mediante acción explícita. Se validan URLs HTTPS, límites, email, colores y firma/tamaño de imágenes. Ante una respuesta incierta no se borran imágenes potencialmente vinculadas; quedan para conciliación manual si una carga no llega a vincularse. Cambiar selección desmonta el formulario; el contexto sólo incorpora respuestas para la misma sesión y organizaciones autorizadas.

Logo principal utiliza brand_logo_url y respaldo legacy logo_url, conservados juntos al guardar. El icono usa brand_favicon_url. La edición de colores guarda la identidad organizacional; no altera el tema elegido por la persona.
