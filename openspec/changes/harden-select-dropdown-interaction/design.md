## Context

SelectDropdown ya conserva foco en trigger, portal modal, flechas y confirmación explícita. La revisión observa índices obsoletos, nombre perdido al usar aria-labelledby, Escape propagado, falta de blur/typeahead y apertura latente después de disabled.

## Goals / Non-Goals

**Goals:** identidad válida con opciones dinámicas, teclado sin efectos inesperados, relaciones ARIA válidas, pruebas en DOM y Chromium real local.

**Non-Goals:** reescritura de UI, certificación global, nuevos permisos/IPC, modificar semántica de Tab o selección controlada.

## Decisions

- Separar navegación de opciones del DOM en un módulo pequeño: tipo de opción reexportado desde el componente para conservar imports. Sin framework ni dependencias.
- Guardar valor activo, no posición. Derivar posición habilitada: activa existente, selección habilitada, primera habilitada o ninguna. El padre conserva valor seleccionado; sólo confirmación llama onChange.
- Sincronizar transición disabled en render mediante actualización condicional del propio estado; no usar un efecto para esconder estado obsoleto ni volver a abrir al habilitar.
- Prefijo con ventana de 500 ms, normalización de acentos y caracteres repetidos para circular. Ref temporal sin timer persistente; ignorar modificadores y composición. No seleccionar automáticamente al explorar.
- Escape del popup previene propagación; estando cerrado puede atenderlo el diálogo. Blur fuera de control/portal y Tab cierran sin escritura. Selección devuelve foco al trigger. Portal dentro de dialog nativo conservado.
- El listbox reutiliza aria-labelledby o aria-label; fallback al trigger. Ninguna referencia activa apunta a una opción ausente/deshabilitada. Movimiento reducido elimina animación/transición no esenciales del control.
- Limitar geometría al espacio disponible, incluidos viewports reducidos. Verificar el control real en Chromium con datos ficticios, árbol AX, foco, portal y zoom; no abrir bootstrap/Supabase ni cuentas reales.
- Usar timestamp del evento y acotar prefijo a la etiqueta más larga; sin reloj impuro en render. Las medidas nativas revelaron que duration-150 también animaba max-height por transition-property inicial all. La lista separa duración de animación y transition-none; el desplazamiento local se calcula tras layout/posición y no se rearma al desplazar la propia lista. La ventana nativa permanece oculta, con foco emulado por CDP para recibir focusin/focusout.

## Risks / Trade-offs

Identidad exige valores únicos como ya exige key de React; no se inventan valores. Sin opciones habilitadas no hay foco activo ni confirmación. El comportamiento Tab previo se conserva y se documenta. Un smoke de un control no acredita lectores de pantalla ni WCAG de todo el producto. Hallazgos IRIS quedan visibles y requieren transición de servidor; no se deshabilita acceso existente como sustituto del arreglo.

## Migration Plan

Sin migraciones. Baseline, casos rojos, implementación, consumidores, tipos/lint/build/gate y autorrevisión. Revertir componente/módulo juntos sin afectar diez unidades previas. Revisión independiente pendiente antes de archivar.
