## Context

`show-agent-activity-window` eligió una ventana Electron porque la vista nativa
del navegador se compone por encima del DOM y taparía un panel HTML. El layout
del navegador ya resuelve ese problema para el chat flotante: descuenta su ancho
de la vista nativa con `viewportInsets`. El panel de equipos puede reutilizar el
mismo mecanismo.

## Goals / Non-Goals

Mostrar la actividad dentro de la aplicación, sin tapar controles ni la página y
sin perder las garantías de datos mínimos y aislamiento. No se agregan controles
de ejecución ni persistencia del estado de apertura.

## Decisions

- Un único `AgentActivityProvider` envuelve el espacio de trabajo y mantiene una
  sola suscripción. El panel y los botones leen su contexto; fuera del proveedor
  el botón no se renderiza.
- Apertura automática una sola vez por equipo nuevo en curso: si el usuario
  oculta el panel, las actualizaciones del mismo equipo no lo reabren.
- Hub: columna de 320 px a la derecha del contenido. Navegador: panel de 300 px
  bajo la barra de pestañas, en el borde derecho. Su ancho y margen se suman al
  inset derecho de la vista nativa. Con el chat también a la derecha, el chat se
  desplaza junto al panel y ambos se descuentan.
- Main sólo difunde a la ventana del Hub. Los canales invocables quedan en
  `snapshot` y `publish`, ambos limitados a los frames principales de Hub y
  Orbe. Main deja de crear, mostrar u ocultar vistas.
- Margen y separación del chat flotante: 6 px. Es la holgura mínima que conserva
  la sombra y el borde redondeado sin pegar el chat a la página.

## Risks / Trade-offs

Con el chat y el panel abiertos, la página pierde unos 312 px adicionales. El
usuario puede ocultar el panel desde el botón o su encabezado sin detener el
trabajo. Si el contenedor es estrecho, el chat se reduce hasta su ancho mínimo.

## Migration Plan

Sin migraciones ni datos persistidos. Revertir el cambio restaura la ventana
nativa. Ningún consumidor externo usaba `agent-activity:control`; sus únicos
usuarios eran el botón flotante y la propia ventana, ambos retirados.
