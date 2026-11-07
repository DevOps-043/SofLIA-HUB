# Barra horizontal del tablero

Fecha: 2026-10-24. Cambio visual local, sin mutaciones de datos.

La barra anterior heredaba los 5 px y el contraste bajo del scrollbar global. Además, el tablero no crecía con el área disponible y su borde inferior podía quedar a media pantalla. La sección Tareas ahora usa composición flex y el tablero ocupa el espacio restante; mantiene desplazamiento propio para las columnas y el contenido vertical. La barra mide 16 px con pista visible, control de 10 px útiles y colores del tema. Se conservaron la vista Lista y las acciones del tablero.

Verificación visual: `node test/manual/task-board/smoke.mjs <directorio>` aprobado. El smoke verifica altura computada de 16 px y borde inferior dentro de los últimos 50 px de la ventana de escritorio, además de recorrer el tablero. Se inspeccionaron capturas claras y oscuras con la barra al pie. También completó filtros, cambio de vista, movimiento, vacío y ancho de 360 px sin desbordamiento horizontal del documento.

`npm run verify:pr` aprobado: tipos, lint, arnés, documentación, OpenSpec y suite general con 5.897 casos aprobados, cinco omitidos y cero fallos (519 archivos aprobados y dos omitidos). `npm run docs:check` también pasó tras actualizar esta evidencia. No se añadieron pruebas unitarias para reglas CSS; se utilizó la comprobación de geometría del smoke existente. Reversión: restaurar la clase condicional del contenedor y las reglas específicas del tablero, sin cambios de contratos ni persistencia.
