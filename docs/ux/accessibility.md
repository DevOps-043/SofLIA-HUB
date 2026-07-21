# Accesibilidad

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: src/components/ui -->
<!-- evidence: src/index.css -->
<!-- evidence: src/app/AppWorkspace.tsx -->

## Estado comprobable

- React usa botones/inputs nativos en primitives y varios componentes declaran
  `aria-label`, `aria-hidden`, roles y estados disabled.
- `AppWorkspace` usa `<main>` y la UI separa headings/sections en componentes.
- Tema claro/oscuro tiene tokens de texto y `on-accent`; el contraste navy sobre
  aqua fue elegido explicitamente para AA.
- Body declara minimo 320 px y scroll interno por pantalla.

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
