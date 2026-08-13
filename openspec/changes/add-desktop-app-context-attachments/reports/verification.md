# Verificación

Fecha: 2026-08-12. Host: Windows 11, sin Office abierto durante la ejecución.

## Compuertas ejecutadas

| Compuerta | Comando | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | Sin errores |
| Pruebas main | `npx vitest run --project main` | 108 archivos, 1234 casos, todos en verde |
| Pruebas renderer | `npx vitest run --project renderer --exclude "**/BrowserAppGridMenu.test.tsx"` | 80 archivos, 597 casos, todos en verde |
| Lint del código cambiado | `npx eslint` sobre los archivos de este cambio | Sin hallazgos |
| Documentación de sistema | `npm run docs:system:check` | 28 documentos, 147 IDs, 343 canales, 364 archivos de prueba |
| Enlaces de documentación | `npm run docs:check` | 182 archivos válidos |
| OpenSpec | `npm run openspec:validate` | 16 de 16 cambios válidos |

## Cobertura nueva

56 casos nuevos: 32 en main y 24 en renderer.

- `desktop-context-inventory.test.ts`: cruce de ventanas con miniaturas, exclusión de Pulse Hub por pid y por título, ventanas sin título, fallo de enumeración, identificador estable entre inventarios, degradación a solo captura fuera de Windows y ausencia de `sourceId` en lo que cruza IPC.
- `desktop-context-cascade.test.ts`: los tres niveles, la degradación entre ellos, documento sin guardar, ruta que no corresponde a la ventana, extensión no soportada, documento vacío, fallo de COM, ventana cerrada durante la extracción, truncado declarado y emparejado de documento con título.
- `desktop-context-handlers.test.ts`: registro de exactamente dos canales, emisor ajeno rechazado, identificador no inventariado rechazado sin devolver contenido, capacidad desactivada sin registrar handlers y saneamiento de rutas Windows y POSIX en los errores.
- `app-attachments.test.ts`: procedencia por nivel, aviso de cambios sin guardar, autoridad acotada de una captura, prohibición de inferir sin contenido, recorte por límite de turno, fallo aislado de una aplicación, espera de lecturas pendientes con presupuesto y refresco del chip al terminar la lectura.
- `AppAttachmentPicker.test.tsx`: nivel previsto por aplicación, estado vacío, reintento tras fallo, capacidad ausente, y el chip declarando fidelidad y avisos.

## Hallazgos preexistentes, no introducidos por este cambio

- **`src/__tests__/components/BrowserAppGridMenu.test.tsx` cuelga la suite renderer indefinidamente.** Se reproduce en aislamiento (`timeout 90` lo mata) y también con los archivos de este cambio retirados del árbol. El archivo está en `16d9158` y sin modificar en el worktree. Es la causa de que `npm run test` no termine. Se excluyó para obtener señal del resto; **debe corregirse aparte** porque bloquea `verify:pr`.
- `npm run lint` falla por `@typescript-eslint/no-explicit-any` en `electron/main/service-factory.ts:1` y `electron/main/startup.ts:20,88-93`, y por `react-hooks/immutability` en `src/adapters/desktop_ui/chat-ui/useChatUIController.ts` (`state.refs.lastScrollTopRef.current`). Las tres firmas existen en HEAD; este cambio no las introduce ni las agrava.

## Pendiente

- Verificación manual en el host con Word, Excel, PowerPoint, un visor de PDF y una aplicación sin accesibilidad, registrando evidencia por nivel de la cascada. Requiere Office instalado y ventanas reales; no se puede automatizar aquí. Es lo único que ejercita COM, UI Automation y `desktopCapturer` de verdad: las pruebas cubren el orquestador y los contratos con dependencias inyectadas, no las tres integraciones nativas.
- `npm run verify:pr` y revisión adversarial, ambos bloqueados por el cuelgue preexistente de la suite renderer.
