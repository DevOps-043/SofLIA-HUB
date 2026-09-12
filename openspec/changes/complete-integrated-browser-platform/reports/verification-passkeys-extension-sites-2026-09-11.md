# Verificación: passkeys y extensiones por sitio

Estado: reporte del corte local. Fecha: 2026-09-11.
Cambio: complete-integrated-browser-platform.
Worktree: .worktrees/upgrade-integrated-browser; rama codex/upgrade-integrated-browser.
Base Git f52c8d6; trabajo anterior preservado, sin commit, despliegue ni instalación del producto.

Se cierra implementación de **4.10 y 5.6**: **61/64 completas**, tres pendientes.
El cierre no acredita aceptación humana de Windows Hello/passkeys, Chrome Web
Store, catálogo firmado, rollback integral, producto empaquetado ni sync remoto.

## Cambios verificados

- Passkeys: se conserva WebAuthn de Chromium y proveedor nativo. Main atiende
  selección de cuenta con diez candidatos máximo, cancelación por defecto y
  plazo de sesenta segundos. Exige marco principal seguro, perfil autenticado,
  ventana/documento visibles y control humano. Cancela una sola vez ante
  cambios de sesión/documento/foco/control, incluso recorridos A→B→A.
  No envía IDs/claves por IPC ni los persiste. Marca identidad sensible e impide
  lecturas/capturas del agente para ese documento, aun sin agentGovernance.
  No intercepta las demás UI nativas de registro/autenticación WebAuthn.
- Extensiones: panel con selección explícita y contrato de cuatro capas.
  Sólo reduce hosts, scripts y recursos del manifiesto previamente aprobado;
  retira permisos opcionales y herencia de scripts estáticos hacia marcos.
  Admite MV3 storage/scripting; no simula aislamiento de APIs globales.
  Exige deshabilitar, cerrar otras páginas y navegar a about:blank en la última.
  Sitios significan esquema y dominio exactos, todos sus puertos; no cortafuegos.
  Recuperar permisos retirados requiere reinstalar la carpeta original.
- Integridad y recuperación: verifica huella antes de modificar, usa las mismas
  cuotas de lectura/carga para validar el resultado y publica nueva huella.
  Un fallo entre manifiesto y registro impide habilitar; no aprueba cambios
  parciales. La recuperación es reinstalación revisada, no rollback automático.
  Errores de E/S no cruzan IPC; no hay rutas ni hashes internos en metadata.

Archivos principales:
[selector passkey](../../../../electron/integrated-browser/passkey-selection.ts),
[restricción del manifiesto](../../../../electron/integrated-browser/extension-site-access.ts),
[gestor](../../../../electron/integrated-browser/extension-manager.ts),
[panel de sitios](../../../../src/components/browser/BrowserExtensionSiteAccess.tsx).

## Evidencia automatizada

- Regresión ampliada: **1.264 pruebas, 100 archivos**, 52,01 segundos, salida 0:
  `npm run test -- integrated-browser Browser browser- orb-show-handler orb-conversation desktop-agent-computer-use-lifecycle gemini-cu-loop gemini-cu-client preload --maxWorkers=4 --reporter=dot --silent=passed-only`.
- Focalizada después de revisión: 236 pruebas en cuatro archivos, salida 0.
- `npm run typecheck`: main y renderer, salida 0.
- `npm run lint:changed`: 278 archivos, sin deuda nueva, salida 0.
- `npx openspec validate complete-integrated-browser-platform --strict`: válido.
- `git diff --check`: salida 0, sólo avisos de normalización LF/CRLF.
- `npm run verify:pr`: adaptadores, harness, cadena de suministro, documentos de
  sistema y enlaces aprobados; falla en skills:seed:check por discrepancia
  preexistente de database/lia/migrations/system-skills-catalog.sql y
  src/shared/skills/registry.ts. Ambos sin diff en este worktree. No se regeneró
  SQL ajeno para ocultar el fallo. Typecheck y lint se ejecutaron por separado
  porque el gate se detiene antes.
- Documentación de sistema: 28 documentos, 150 IDs, 425 canales y 466 archivos
  de prueba. Inventario no equivale a número de pruebas ejecutadas.

## Runtime nativo

`npm run browser:smoke:native -- --electron RUTA_ABSOLUTA_DEL_ELECTRON_LOCAL`:
**80 comprobaciones aprobadas**, salida 0, Electron 43.4.0.
Resultados aislados conservados en
`C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-JIJlnc/`.

| Fase | Comprobaciones |
|---|---:|
| exercise | 12 |
| restore | 4 |
| lifecycle | 3 |
| vault | 11 |
| autosave | 11 |
| zoom | 13 |
| safety | 12 |
| passkeys | 9 |
| extensions | 5 |

Passkeys consulta disponibilidad del proveedor Windows sin abrir autenticación.
Altas y aserciones usan un autenticador virtual CTAP2 desechable; no se extraen
claves privadas ni se registran credenciales personales. El selector usa respuesta
de fixture; no es aceptación humana ni prueba de autofill condicional.

Extensiones usa código de prueba local y gestor real: la compilación conserva
huella válida; Chromium inyecta sólo en host permitido y marco principal.
Se rechaza scripting dinámico en host retirado y no reaparece un registro
persistAcrossSessions previo al descargar/restringir/recargar. Vaciar sitios
impide nuevas inyecciones. No se instalaron extensiones de terceros.
Se corrigió la salida prematura del harness para escribir su reporte antes de
cerrar el proceso; la ejecución fallida anterior no se cuenta como aprobada.

## Revisión adversarial

La revisión independiente detectó dos P2, corregidos con regresión:

1. Un diálogo passkey podía revivir tras cambiar de pestaña A→B→A; ahora fija
   también revisión de foco, no sólo identidad del documento.
2. Expandir patrones podía publicar un manifiesto que no cabía en las cuotas
   del cargador. Ahora se comparte validación de metadata y se comprueban
   256 KiB de manifiesto/20 MiB de paquete antes de escribir; pruebas de
   demasiados hosts, manifiesto ampliado y paquete al límite preservan bytes.

Se intentaron refutar permisos mediante host parecido, listas vacías, APIs
globales, payloads extra, marco ajeno, sesión A→B→A, scripts persistentes,
fallo al publicar registro y cuotas. La revisión principal completó las
comprobaciones; la revisión delegada no produjo dictamen final completo.

Riesgos restantes: no monitor continuo ni defensa ante un proceso con permisos
para modificar código y registro. Deshabilitar una extensión por sí solo no
retira scripts existentes; el cierre/navegación en blanco es obligatorio.
No se promete control de toda la red ni de todas las UI nativas WebAuthn.

## Pendientes y fuentes

- **5.7:** catálogo curado, autenticidad del editor y actualización explícita.
  El usuario permite elegir cualquier candidato; eso no autoriza a confiar
  en código arbitrario. Se inspeccionó el ejemplo oficial
  [Reading Time de GoogleChrome](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/tutorial.reading-time)
  como posible paquete pequeño: candidato, no extensión probada o instalada.
  Falta fijar revisión/huellas, verificar distribución y conectar actualización.
- **8.7:** migraciones, respaldos y rollback de los stores restantes; la base
  previa de sesión/bóveda no satisface todo el alcance.
- **9.5:** smoke del producto e instalador Windows, interacción humana con
  Windows Hello/passkeys y despliegue autorizado más Auth/RLS/revocación de
  sync Lia entre dos equipos reales. Fixtures no sustituyen estas pruebas.

Contratos primarios consultados:
[selección WebAuthn de Electron](https://www.electronjs.org/docs/latest/api/session#event-select-webauthn-account),
[API de extensiones](https://www.electronjs.org/docs/latest/api/extensions-api).
La evidencia nativa corresponde a la versión instalada, no a una promesa de
paridad con Chrome/Brave/Edge ni al estado más reciente de su documentación.
