# Accesibilidad

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: src/components/ui -->
<!-- evidence: src/index.css -->
<!-- evidence: src/app/AppWorkspace.tsx -->
<!-- evidence: src/components/browser/BrowserWorkspaceLayout.tsx -->
<!-- evidence: src/components/browser/IntegratedBrowserPanel.tsx -->
<!-- evidence: src/components/browser/BrowserDialog.tsx -->
<!-- evidence: src/components/browser/BrowserManagementPanel.tsx -->

## Estado comprobable

- React usa botones/inputs nativos en primitives y varios componentes declaran
  `aria-label`, `aria-hidden`, roles y estados disabled.
- `AppWorkspace` usa `<main>` y la UI separa headings/sections en componentes.
- Tema claro/oscuro tiene tokens de texto y `on-accent`; el contraste navy sobre
  aqua fue elegido explicitamente para AA.
- Body declara minimo 320 px y scroll interno por pantalla.
- El grip del chat flotante expone `role="separator"`, valores ARIA, foco,
  flechas de teclado y un agarre visual con área de interacción amplia.
  El chat mantiene radios y borde perceptible, reemplaza su header general por
  un selector compacto de modelo/razonamiento; cada nivel se presenta como fila
  `role="radio"` con nombre, descripción y marca visual, y contiene el overflow horizontal. Mover, minimizar y restaurar son
  controles con nombre accesible y `title`. El inicio vertical se deriva del
  viewport web para no solapar los controles superiores del navegador.
- El acceso compacto a conversaciones expone `aria-expanded`, un diálogo
  nombrado, búsqueda etiquetada, chat activo, cierre por Escape/clic exterior y
  acciones operables por teclado para crear o cambiar de chat.
- La fila de pestañas comunica la activa mediante `role="tab"` y
  `aria-selected`; los modos simple, dividido y superpuesto usan
  `aria-pressed`. Crear, cerrar, mostrar junto, activar Orbe y restaurar chat
  tienen nombres independientes del icono. El compositor compacto mantiene un
  nombre accesible y un placeholder visual de una línea truncable con padding
  vertical simétrico.
- La barra de dirección usa `combobox`/`listbox`, anuncia la sugerencia activa y
  permite recorrer historial con flechas, confirmar con Enter o cerrar con Escape.
  El listado flota debajo del campo sin cambiar la altura del header y limita
  ancho/altura para conservar contexto. Mientras está visible, una captura
  puntual sustituye a la capa nativa; seleccionar, Escape, perder foco o quedar
  sin resultados restaura la misma vista sin recargar. El control para plegar
  herramientas permanece disponible en ambos estados.
- La fila secundaria expone una región "Favoritos y extensiones": agregar la
  página actual comunica `aria-pressed`, cada favorito tiene navegación y
  eliminación separadas, y cada extensión anuncia nombre y estado.

- Los gestores flotantes del navegador usan `role="dialog"`, titulo y descripcion
  asociados, ciclo de foco, cierre con Escape y restauracion del foco de origen.
  Las confirmaciones destructivas nombran el objeto y la consecuencia, y mantienen
  acciones de cancelar/confirmar diferenciadas por texto ademas del color.

Esto no constituye certificacion WCAG. No existe objetivo WCAG formal, prueba axe
en CI ni auditoria de lector de pantalla versionada.

## Requisitos para cambios nuevos

| Area | Criterio verificable |
|---|---|
| Teclado | todas las acciones alcanzables con Tab/Shift+Tab/Enter/Space/Escape; sin focus trap accidental |
| Nombre | icon-only con `aria-label`; input asociado a label; heading describe seccion |
| Foco | visible en ambos temas y restaurado al cerrar modal/menu |
| Estado | loading, expanded, selected, invalid y pressed comunicados semanticamente |
| Contraste | texto/controles revisados en claro/oscuro; no asumir que token garantiza toda combinacion |
| Color | error/warning/success incluyen texto/icono, no solo tono |
| Movimiento | animacion no esencial respeta reduced motion y no bloquea accion |
| Zoom | contenido usable al 200%; no recortar CTA por `overflow-hidden` global |
| Audio | dictado muestra estado/transcripcion y errores; acciones no dependen solo del sonido |
| Tiempo | timeouts de UI no deben borrar informacion sin forma de recuperarla |

## Zonas de riesgo actuales

- Dropdowns y menus custom requieren revision de roles, flechas, Escape y foco.
- Canvas/orbe/visualizaciones no tienen equivalente semantico completo demostrado.
- Sidebar reposicionable y modales anidados pueden alterar orden de tab.
- Scroll global oculto obliga a cada vista a definir un contenedor accesible.
- Texto secundario y bordes sutiles deben verificarse en monitores de bajo
  contraste; no existe test visual automatizado.
- Intro de 4.2 s y animaciones no consultan globalmente `prefers-reduced-motion`.

## Checklist manual minimo

1. Navegar flujo cambiado sin mouse.
2. Confirmar foco antes/durante/despues de modal.
3. Probar claro/oscuro y 200% zoom.
4. Inspeccionar nombre/role/state en accessibility tree.
5. Probar loading, empty, error, disabled y permiso denegado.
6. Si hay audio/canvas, verificar alternativa textual.

Automatizar axe y formalizar WCAG son mejoras pendientes; no se marcan como
implementadas en la matriz.
