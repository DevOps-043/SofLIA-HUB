# Contexto

- Actor: usuario humano del navegador integrado; agentes runtime por ruta propia.
- Objetivo: interacción inmediata sin trabajo repetido en main o en los frames.
- Alcance: acuses de open/navigate/tab-create, viewport y selección de texto.
- Bug añadido por el usuario: página nativa superpuesta al chat, sin barra del
  navegador. Reproducido con recarga del renderer: la vista Electron sobrevive
  al desmontaje abrupto de React. Retirar geometría y visibilidad al perder la UI.
- Límites: conservar navegación segura y llamada Huddle ya reparada; no prometer
  acelerar al proveedor o la descarga de contenido externo.
- Contratos: mismos canales y `{success,state}`; opción booleana `waitForLoad`
  opcional, true por defecto. La UI pide false y puede recibir `state.isLoading`
  verdadero al acusar inicio; errores de carga llegan por estado.
- Seguridad: controles antes de loadURL, guardas para errores tardíos y resultados
  de selección; agente sigue esperando carga completa.
- Evidencia: sonda local sin .env, Google, cuentas ni proveedores externos.
- Incertidumbre: cuánto tiempo pertenece a red y proveedor en Gmail; el benchmark
  mide trabajo de SofLIA y no equivale a una llamada remota contestada.
