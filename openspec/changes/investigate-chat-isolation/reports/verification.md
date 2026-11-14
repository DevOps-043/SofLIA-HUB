# Verificación de aislamiento y continuidad de chats

Fecha: 2026-11-14. Base: `855192c3`. Rama aislada: `codex/chat-isolation-audit`.

## Resultado y alcance

Se implementaron los ocho hallazgos de la [auditoría inicial](audit.md).
Las seis reproducciones marcadas antes como fallos esperados son ahora pruebas
normales y pasan. Las pruebas de integración usan caché/colas reales, SQLite
real, filesystem temporal y exportación real de PowerPoint; el proveedor de IA
y la red son dobles controlados. No se afirma haber recuperado el chat real
del incidente ni completado su presentación histórica.

| Hallazgo | Corrección | Evidencia principal |
|---|---|---|
| H-01 | UUID reservado del borrador, asociación explícita y custodia main del workspace | `chat-workspace-isolation-audit`, `skill-workspace-link`, `background-presentation-isolation` |
| H-02 | Primer mensaje y conversación en almacenamiento local antes de inferencia; caché propio conservado ante listados parciales | `chat-save-isolation-audit`, `chat-navigation-isolation`, `process-message-settle` |
| H-03 | Registro estable de handlers/colas por destino, flush independiente de la red | `chat-save-isolation-audit`, recorrido A → B → A sin red |
| H-04 | Skill/panel filtrados por origen y retirados antes de esperar IPC | `chat-workspace-isolation-audit`, `skill-workspace-resume` |
| H-05 | Generación de activación invalidada al navegar/desactivar/cambiar identidad | `chat-workspace-isolation-audit`, `skill-workspace-resume` |
| H-06 | Encargo de Presentaciones admitido en main, reserva de escritor, validación de deck e imágenes y PPTX leído/verificado | `background-presentation-isolation`, `background-teams`, `process-message-settle` |
| H-07 | Envío externo y manual comparten guardas, señal y generación; memoria por chat/propietario | `chat-external-turn-audit`, `chat-runtime-owner`, `chat-semantic-memory-isolation` |
| H-08 | Origen inmutable, filtros Este chat/Todos, regreso al origen y preparación distinta de ejecución durable | `AgentActivityPanel`, `agent-activity-store` |

Los archivos de pruebas viven bajo `src/__tests__/` o `electron/__tests__/`.
El detalle del contrato vigente está en
[aislamiento de chats](../../../../docs/architecture/chat-context-isolation.md).

## Casos negativos y revisión adversarial

Se intentó refutar que bastara con no cancelar el renderer. Se verificaron
borrador → chat existente, consulta IPC lenta/rechazada, activación tardía,
desactivación mientras se recupera una Skill, navegación rápida A/B/A, dos
borradores, almacenamiento fallido, red pendiente y usuario cambiado. Los
resultados tardíos no reciben autoridad sobre el destino visible ni sustituyen
el historial de un turno posterior. Navegar durante la carga inicial tampoco
deja permanentemente el indicador de carga.

Se probaron workspace de otro chat/usuario/organización, escritor simultáneo,
reutilización de requestId con otro origen y reserva revocada durante escritura
atómica. Ninguno concede acceso. Stop, cambio de sesión y cambio de organización
mantienen cancelación y guardas. La última intención de organización prevalece
sobre consultas anteriores. La lectura de custodia legada se prueba con el SDK
Supabase real y fetch simulado, incluyendo revocación durante la consulta;
no se realizaron mutaciones ni consultas a datos reales.

La revisión detectó y corrigió pérdida de generación de imágenes al mover la
Skill a main y el antiguo límite de 2 MB incompatible con un deck con imágenes.
Ahora la generación usa el cliente nativo ligado a la sesión, cuenta llamadas
y tokens del trabajo y no publica respuestas posteriores a cancelación. Un
PPTX con imagen sintética real mayor de 2 MB se exporta y comprueba dentro del
límite del visor. La excepción no aplica a otros trabajos/formatos. Sólo el
coordinador recibe herramientas de workspace; ninguna permite shell, borrado,
envío o elegir otro destino. Las imágenes se observan como evidencia no confiable.

## Comandos y límites de verificación

Las regresiones dirigidas pasan. La suite completa y las compuertas se
ejecutaron por separado; sus resultados exactos se consignan a continuación.

- `npm run test -- --reporter=dot`: 650 archivos; 646 aprobados,
  2 fallidos y 2 omitidos. 7,599 pruebas aprobadas, 5 fallidas y 5 omitidas
  (7,609 casos, 160.45 s). Las cinco fallidas son la comprobación de nonce
  MSAL y cuatro límites de colecciones Zod preexistentes.
- Tras esa suite se añadieron dos casos de reinicio/reanudación y cambio de
  organización: ejecución dirigida de `background-presentation-isolation`,
  `background-teams`, `cross-surface-agent-team`, `chat-navigation-isolation`
  y `skill-workspace-resume`: 5 archivos y 81 pruebas aprobadas.
- `npm run lint:changed`: 72 archivos sin deuda nueva.
- `npm run harness:validate`: 25 rutas y 10 skills válidas.
- `npm run docs:check`: enlaces válidos en 1098 documentos activos.
- `npm run docs:system:check`: 28 documentos, 150 IDs, 543 canales y
  847 archivos de prueba; inventario regenerado por su comando canónico.
- `openspec validate investigate-chat-isolation --strict --no-interactive`:
  aprobado.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json`:
  aprobado.
- `npm run typecheck`: detenido por los tres TS2353 existentes de
  `nonce`/`AuthorizationCodeRequest` en Calendar. No hay nuevos diagnósticos
  del cambio; el proyecto node se comprueba por separado.
- `npm run verify:pr`: adapters, harness, supply-chain e integridad CI pasan;
  se detiene en `runtime:stable` porque Electron instalado 44.5.1 no coincide
  con 44.9.3 declarado. No se afirman aprobadas sus etapas posteriores.
- Dependencias reutilizadas mediante junction, sin cambiar el manifiesto ni
  lockfile: MSAL 5.5.0 frente a 7.1.1 declarado, Zod 4.4.3 y Vitest 4.1.10.
  Los fallos de Calendar y límites Zod también se reprodujeron en el worktree
  de branding basado en el mismo HEAD sin las modificaciones de chats.

No se ejecutó IA pagada, instalador ni prueba visual de cada diapositiva. La
validación técnica de los archivos no certifica hechos no respaldados por fuentes.
La continuidad empieza al admitir el trabajo en main; la captura previa de
aplicaciones vivas sigue supervisada. Cerrar la aplicación interrumpe el proceso
local y exige reanudar; no se promete ejecución con el equipo apagado.

## Integración en el checkout principal

El parche se aplicó tras `git apply --check`, sin reemplazar archivos completos
con trabajo ajeno. Se comprobaron huellas de 60 archivos ajenos antes/después;
ninguno cambió. Las adiciones a los tres documentos compartidos preservan sus
párrafos de voz. El inventario se regeneró en el checkout combinado.

- Pruebas dirigidas integradas, incluyendo Auth y los archivos de regresión
  modificados: **19 archivos y 176 casos aprobados**, 11.50 s.
- Arnés y OpenSpec aprobados; enlaces válidos en 1109 documentos y sistema
  válido con 850 archivos de pruebas (incluye las pruebas de voz preexistentes).
- Typecheck reproduce únicamente los tres errores Calendar descritos arriba.
  `verify:pr` se detiene en la misma incompatibilidad Electron.
<<<<<<< HEAD
- El primer lint del checkout combinado encontró 11 incidencias en
  `electron-builder.windows.cjs`, archivo del trabajo de voz cuya huella no
  se modificó. La consolidación posterior en main incorporó ese archivo al
  ámbito Node CommonJS existente de ESLint: 109 archivos pasan sin deuda nueva.
  Véase [evidencia de consolidación](main-integration.md).
=======
- El lint del checkout combinado encuentra 11 incidencias en
  `electron-builder.windows.cjs`, archivo del trabajo de voz que ya estaba
  presente y cuya huella no se modificó. El lint del cambio aislado pasa;
  no se altera ese archivo ni la configuración para ocultar sus incidencias.
>>>>>>> origin/codex/chat-isolation-audit
- El cambio visual adicional del acceso muestra `SofLIA Hub`,
  `Continuar con SofLIA Academy` y reutiliza `public/assets/Icono.png` en
  lugar del icono de entrada. Las pruebas Auth pasan dentro de los 176 casos.

La suite completa citada arriba corresponde al cambio aislado; no se atribuye
esa cobertura al conjunto del trabajo de voz no relacionado.

## Reversión

Revertir exclusivamente el diff de este cambio, preservando los cambios de voz
y branding del checkout principal. No hay migración ni modificación de secretos.
Los campos nuevos del contrato son opcionales; no borrar workspaces, caché,
colas o artefactos existentes al revertir. Los trabajos admitidos con herramientas
de workspace necesitan esta versión para reanudarse; detenerlos explícitamente
antes de volver a una versión anterior. No reasociar por títulos el chat real
del incidente sin verificar propietario, organización y respaldo.
