# Verificación: atajos de lectura del navegador

Fecha: 2026-09-09. Cambio: `complete-integrated-browser-platform`.
Worktree: `.worktrees/upgrade-integrated-browser`, rama `codex/upgrade-integrated-browser`.
Resultado: cierra **6.7**, progreso **53/64**, **11 pendientes**.

## Implementación

- Biblioteca de instrucciones reutilizables en el menú del compositor, con
  creación, edición, elección, borrado, estados vacíos/error y actualización.
  Elegir prepara el borrador, nunca envía automáticamente ni sobrescribe uno.
- Contrato cerrado `selected-tabs` / `read-fragments`; al enviar requiere una
  a ocho pestañas del perfil original y lectura fresca. Rechaza Skills, modos
  especiales y otros adjuntos. Reutiliza fuentes citables y los límites de
  herramientas de ambos proveedores; no es una macro de acciones.
- Store main v1 protegido por `safeStorage`, ligado al ámbito, con revisión
  optimista, cuota de 50 entradas, nombre de 80 caracteres e instrucción de
  5000. Lectura limitada a 2 MiB y publicación por temporal exclusivo/rename.
  Corrupción, versión futura, pérdida de cifrado o error de publicación no se
  convierten en biblioteca vacía ni sustituyen silenciosamente el archivo.
- Un IPC nuevo con sesión, marco principal, recibo de perfil y validación de
  campos; preload allowlisted y wrapper tipado. No acepta rutas, ejecución ni
  permisos adicionales. Los errores de E/S no llegan al renderer.
- Eliminar exige confirmación nativa, revisión vigente, cinco minutos máximo
  y exclusión de diálogos. Se invalida al cambiar perfil/ventana/control.
  Guardar no persiste URLs, contenido de pestañas ni concesiones de sitios.

## Verificación ejecutada

| Comando | Resultado |
|---|---|
| `npm run test -- integrated-browser browser-shortcut BrowserAgentShortcutsPanel browser-tab-sources attachment-preparation ChatInputArea gemini-chat-routing skill-tool-loop openai-workspace-turn preload` | 936 pruebas, 61 archivos, aprobados |
| Pruebas dirigidas de atajos, handler, preload, wrapper, compositor y servicio | 276 pruebas, 8 archivos, aprobados antes de añadir un caso de publicación/versión futura; se solapan con la regresión, no sumar |
| `npm run typecheck` | Aprobado en main y renderer |
| `npm run lint:changed` | 231 archivos sin deuda nueva |
| `npx openspec validate complete-integrated-browser-platform --strict` | Aprobado |
| `git diff --check` | Aprobado, salida 0 |
| `npm run verify:pr` | Bloqueado por discrepancia preexistente en `skills:seed:check` |

Antes del bloqueo, la compuerta aprobó adaptadores (27), harness (25 rutas,
9 skills), cadena de suministro, enlaces y documentación de sistema (28
documentos, 150 IDs, 420 canales y 448 archivos de prueba). El navegador tiene
108 operaciones invocables y 118 canales incluyendo eventos. Las cifras se
contrastaron con los validadores; no describen pruebas del producto instalado.
No se modificaron `database/lia/migrations/system-skills-catalog.sql` ni
`src/shared/skills/registry.ts`. La suite global de la compuerta no se ejecutó.

## Revisión adversarial

Se intentaron refutar aislamiento de perfil, permisos cerrados, revisión
optimista, borrado consentido, preservación del borrador y rechazo de resultados
tardíos. Se cubrieron contrato ampliado, capacidad apagada, perfil invitado,
ID ajeno, biblioteca copiada entre ámbitos, corrupción, versión futura, cuota,
fallo de rename, cancelación/expiración y cambio de perfil durante confirmación.
La UI descarta una biblioteca pendiente tras cambiar de perfil y conserva la
edición ante error; el envío no degrada a chat libre si se quitan las pestañas.

Se corrigió una ventana de transición: el guard del servicio comprobaba su
perfil interno, pero el store resolvía el ámbito global. La nueva operación
contrasta también ambos ámbitos antes y después de esperas. Las pruebas
detectaron además fixtures incompletos, cifras IPC desactualizadas, una API de
arrays incompatible con el target TypeScript y un aviso de ciclo de vida del
efecto; se corrigieron sin desactivar reglas ni cambiar el target del proyecto.

El doble global de `safeStorage` no cifra: las pruebas demuestran invocación y
reapertura mediante esa API, no criptografía nativa. No se sustituyó el doble
por una falsa demostración de cifrado ni se enviaron solicitudes reales al modelo.

## Disponibilidad, límites y reversión

- Requiere `BROWSER_AGENT_GOVERNANCE_ENABLED=true`, perfil autenticado
  persistente, control humano y política empresarial que permita al agente.
  No se modificaron `.env`, flags locales ni configuración de producción.
- Son atajos de lectura manual, no acciones automáticas, búsqueda semántica,
  contraseñas, sincronización ni ejecución programada. El usuario elige nuevas
  pestañas y confirma cada envío; puede quitar explícitamente el modo de atajo.
- El cifrado es local del SO, no E2EE ni protección contra procesos del mismo
  usuario. No guardar secretos en instrucciones. Los fragmentos enviados al
  chat conservan sus reglas de persistencia/acceso, no las de esta biblioteca.
- Sin bloqueo multiproceso, recuperación automática ni garantía de durabilidad
  ante corte eléctrico. El borrado no promete eliminación forense. El recorrido
  completo en Windows/instalador permanece en 9.5.
- Rollback: retirar esta UI, canal y store manteniendo el archivo protegido
  sin borrarlo. No requiere migración remota ni cambiar perfiles, bóvedas o chats.
  No hubo commits, despliegues ni mutaciones externas en este corte.

## Pendientes reales

2.5 zoom aislado; 4.8 autenticación del SO/bloqueo de bóveda y formularios
avanzados; 4.10 passkeys; 5.6 permisos de extensiones por sitio; 5.7 catálogo,
editor y actualización de extensiones; 6.4 pausa/reanudación/toma de control
completa; 6.5 handoff sensible; 6.8 índice semántico opt-in; 6.9 voz de Orbe;
8.7 migraciones/rollback de stores restantes; 9.5 smoke Windows/instalador y
validación Lia Auth/RLS con dos equipos reales.
