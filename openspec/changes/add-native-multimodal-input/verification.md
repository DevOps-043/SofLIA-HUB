# Verificación — add-native-multimodal-input

Rama: `codex/native-multimodal-input`. Worktree: `.worktrees/native-multimodal-input`.
Base: `7a174af`.

## Compuertas automáticas

| Compuerta | Resultado |
|---|---|
| `tsc --noEmit -p tsconfig.json` | limpio |
| `tsc --noEmit -p tsconfig.node.json` | limpio |
| `vitest --project main` | 1301/1302 (1 fallo preexistente, ver abajo) |
| `vitest --project renderer` | ver ejecución final |
| `npm run docs:check` | enlaces válidos en 195 archivos |
| `npm run audit:supply-chain` | 11 versiones vetadas ausentes, 18 ganchos revisados |
| `eslint` sobre los archivos nuevos | limpio |

**Fallo preexistente, no introducido por este cambio:** `WA-160` en
`electron/__tests__/whatsapp-workflow-presentacion.test.ts` falla de forma
idéntica al hacer checkout del commit base `7a174af` con este cambio
descartado. Queda fuera del alcance.

**Lint del repositorio completo:** `npm run lint` reporta 2481 problemas, todos
en archivos que este cambio no toca (`test/mocks/*` en su mayoría). Es una
condición previa del repositorio; el lint acotado a los archivos nuevos y
modificados por el cambio sale limpio.

## Pruebas añadidas

| Suite | Qué fija |
|---|---|
| `src/__tests__/services/gemini-chat-streams.test.ts` | 7 casos. `text` como descriptor de acceso (una prueba falla si el código lo invoca como función), fuentes resueltas al terminar el stream, y el camino en que el usuario cancela y abandona el generador a medias. |
| `src/__tests__/services/multimodal-message-content.test.ts` | 21 casos. Las cuatro rutas de transporte, recorte de ventana, rechazos con motivo y la degradación ordenada completa. |
| `electron/__tests__/media-input-service.test.ts` | 12 casos. Ciclo de subida, procesamiento que no termina, cancelación, caducidad y saneamiento del error. |
| `electron/__tests__/browser-capture-quality.test.ts` | 7 casos. Detección de cuadro no utilizable y normalización de URL de video público. |
| `src/__tests__/services/browser-vision-tools.test.ts` | 12 casos. Las dos herramientas de visión y todas sus degradaciones declaradas. |
| `src/__tests__/services/media-attachments.test.ts` | 10 casos. Límites del compositor con su motivo concreto. |
| `src/__tests__/services/ambient-audio.test.ts` | 10 casos. Guardas de la escucha y encapsulado WAV. |
| `src/__tests__/services/chat-prompt-browser-vision.test.ts` | +4 casos sobre las cláusulas nuevas del prompt. |

## Hipótesis que se intentaron refutar

**"El turno sobrevive a la migración de SDK sin cambios de comportamiento."**
Refutada parcialmente y corregida: `chunk.text` pasa de método a descriptor de
acceso y la respuesta pierde el envoltorio `.response`. Ambas quedan fijadas por
prueba. Una tercera diferencia apareció al escribirlas: sin `response` aparte
del stream, las fuentes solo pueden resolverse al terminar, y el `break` del
botón Stop dejaba `await result.sources` colgado para siempre. Resuelto con un
`finally` en el generador.

**"La degradación por presupuesto excedido está implementada."** Refutada. La
primera versión solo hacía el último paso —excluir el medio—, de modo que pedir
resolución alta sobre 60 s de video dejaba al usuario sin ninguna evidencia en
vez de entregarla con menos detalle. Corregido con la escalera completa:
resolución, luego ventana conservando el instante actual, luego exclusión.

**"El muestreo de cuadros es indistinguible del video para el modelo."**
Confirmada como riesgo y mitigada en tres capas: el resultado de la herramienta
lleva `evidencia: "muestreo-de-cuadros"` y una nota explícita, el prompt exige
declararlo, y hay prueba de ambas.

**"Un cuadro negro de DRM llega al modelo como evidencia válida."** Confirmada
en el diseño original y cerrada: la evaluación ocurre en main sobre el bitmap,
antes de que la imagen salga del equipo, y el resultado prohíbe describir la
escena.

**"El modelo puede iniciar una escucha de audio por su cuenta."** Cerrada:
`authorizedByUser` no tiene valor por omisión y hay prueba de que sin él no se
abre ningún dispositivo.

## Hallazgos de la revisión adversarial

Tres defectos propios encontrados y corregidos:

1. **Ventana de video con aritmética redundante.** Los dos términos del
   `Math.min` eran algebraicamente idénticos; la expresión era ilegible y
   frágil ante cualquier cambio de `buildPlaybackWindow`. Simplificada.
2. **Escucha ambiental perdía los primeros bloques de audio.** La acumulación
   se condicionaba a `this.pipeline`, que solo existe al final de `attach()`,
   mientras el audio empieza a fluir al conectar los nodos. Sustituido por una
   bandera activada antes de conectar.
3. **Conjunto de subidas canceladas sin límite.** Solo lo limpiaba `release()`,
   que el renderer no siempre llama. Ahora también se limpia al alcanzar un
   estado terminal.

## Riesgo residual

- **Salida de datos nueva.** Un medio adjuntado sale del equipo y vive en la
  infraestructura del proveedor hasta caducar; la URI de un video público se
  envía para que el proveedor lo descargue. Mitigado con consentimiento por
  sesión, liberación al cerrar el turno y tratamiento en
  `docs/security/security-and-privacy.md`, pero la copia remota no está bajo
  control de la aplicación una vez subida.
- **`media-input:upload` acepta una ruta arbitraria del renderer.** No está
  expuesto como herramienta del modelo —solo lo invoca el compositor con una
  ruta que el usuario eligió—, así que el riesgo se acota a un renderer
  comprometido, escenario en el que ya hay problemas mayores. Se documenta como
  límite conocido en lugar de añadir una guarda que no puede verificar el
  origen de la ruta.
- **La captura explícita amplía lo que el modelo puede ver.** Antes la evidencia
  visual dependía de un heurístico de texto; ahora el modelo puede pedir un
  cuadro a resolución completa cuando lo considere. El contenido sigue siendo
  dato no confiable por prompt y las acciones conservan sus guardas, pero la
  superficie observable creció.
- **El umbral de cuadro uniforme clasifica como no utilizable una escena
  legítimamente negra** (un fundido). Es el error correcto —declarar que no se
  ve nada cuando no se ve nada— pero puede sorprender al usuario.
- **Dos SDK de Google conviven** en el árbol. Ambos ya estaban instalados, así
  que no crece la superficie descargada, pero la retirada de
  `@google/generative-ai` queda pendiente de un cambio de limpieza.

## Verificación manual pendiente

Requiere ejecutar la aplicación y no se ha realizado en esta entrega:

- Video público de YouTube con pregunta sobre la escena, sin transcripción
  abierta.
- Reproductor no direccionable (contenido autenticado) y confirmación de que la
  respuesta declara el muestreo.
- Contenido protegido por DRM (Netflix o similar) y confirmación de que declara
  no poder verlo en vez de describirlo.
- Adjunto de video sobre el presupuesto en línea, audio corto, formato no
  admitido y cancelación de subida a media transferencia.
- Escucha ambiental en cada plataforma disponible, incluida la degradación
  cuando no hay captura de salida.
