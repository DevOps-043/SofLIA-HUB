# Sistema visual, UX y paleta

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: src/index.css -->
<!-- evidence: tailwind.config.js -->
<!-- evidence: src/components/ui/Button.tsx -->

## Fuente de verdad

`src/index.css` define tokens CSS y los publica a Tailwind 4 mediante `@theme`.
`tailwind.config.js` conserva contenido, dark selector, Inter y animaciones base.
Los componentes de `src/components/ui/` son primitives actuales; patrones de
documentos legacy o de otra aplicacion SOFIA no aplican.

## Paleta tema claro

| Token | Valor | Uso |
|---|---|---|
| `background` | `#f9fafb` | canvas general |
| fondo shell intro/workspace | `#f4faf9` | envolvente de `AppContent` |
| `sidebar` | `#f0f2f5` | navegacion |
| `card` / `surface` | `#ffffff` | tarjetas y paneles |
| `surface-2` | `#f1f3f5` | inputs, wells, anidacion |
| `border` | `#e9ecef` | separadores |
| texto principal / `primary` | `#0a2540` | texto y accion primaria navy |
| texto secundario | `#6c757d` | metadata |
| `accent` | `#0a2540` | accent claro pedido por producto |
| `on-accent` | `#ffffff` | texto sobre accent |

## Paleta tema oscuro

| Token | Valor | Uso |
|---|---|---|
| `background` | `#0f1419` | canvas |
| fondo shell | `#080b11` | envolvente principal |
| `sidebar` / `surface-2` | `#0a0d12` | navegacion e inputs profundos |
| `card` / `surface` | `#1e2329` | tarjetas |
| `border` | `rgba(255,255,255,.08)` | separadores sutiles |
| texto principal / `primary` | `#ffffff` | contenido principal |
| texto secundario | `#9aa4af` | metadata |
| `accent` | `#00d4b3` | accion/feedback de marca |
| `on-accent` | `#0a2540` | texto navy sobre aqua |

El comentario de codigo confirma dos decisiones: navy como accent claro por
solicitud de usuario y navy sobre aqua oscuro para contraste AA. El resto se
interpreta como sistema SOFIA actual; no existe ADR de branding versionado.

## Colores semanticos

- Success `#10b981`.
- Warning `#f59e0b`.
- Danger `#ef4444`.
- El estado siempre debe incluir icono/texto; color solo no basta.

## Tipografia

- Familia: Inter desde Google Fonts; fallback `system-ui, sans-serif`.
- Pesos solicitados: 100-900.
- Riesgo offline: la URL remota puede fallar; el fallback debe conservar layout.
- Jerarquia se implementa con utilities Tailwind; no hay escala tipografica
  versionada como tokens numericos adicionales.

## Forma, espacio y movimiento

- Primitives usan radios medianos/grandes y superficies theme-aware; se debe
  conservar consistencia con el componente, no copiar clases ad hoc.
- Animaciones globales: `fadeIn` .2 s, `slideUp` .3 s, `viewSlideIn` .35 s y
  menu contextual .14 s con curvas definidas en CSS.
- Scrollbars dark y sidebar usan 4-5 px y accent al hover.
- `html`, `body` y `#root` ocupan viewport y ocultan overflow; cada pantalla debe
  administrar su scroll interno.
- Ancho minimo de body: 320 px. Electron desktop no implica asumir monitor grande.

## Primitives disponibles

| Componente | Proposito |
|---|---|
| `Button` | variantes de accion, disabled y loading segun props |
| `Card` | superficie/borde/padding coherente |
| `TextField`, `TextArea` | entrada con label/error/disabled |
| `Toggle` | booleano visible y operable |
| `SelectDropdown` | seleccion estilizada; debe conservar teclado/semantica |
| `Badge` | estados no interactivos |
| `SectionHeader` | titulo/descripcion/acciones de seccion |
| `Icons` | iconos SVG locales |

## Decisiones UX

- Claro y oscuro son capacidades de primera clase: tokens cambian, no se invierte
  toda la UI.
- Sidebar posicionable responde a preferencia de flujo; se persiste en local/main.
- Orbe separada evita que una experiencia de voz flotante herede el layout del
  workspace.
- Aprobaciones usan acciones explicitas porque la confirmacion es parte del modelo
  de negocio, no un toast.
- Integraciones muestran disconnected/pairing/degraded para no confundir ausencia
  de credenciales con error de producto.

## Prohibiciones

- No hardcodear un nuevo color de marca si ya existe token.
- No usar `dangerouslySetInnerHTML` con texto remoto sin sanitizar.
- No implementar custom dropdown sin teclado, roles y foco.
- No copiar el antiguo standard SOFIA Web: mencionaba rutas inexistentes en este
  repositorio y fue sustituido por este catalogo basado en codigo.
