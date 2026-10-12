# Verificación del acompañamiento visual

Estado: verificación local completada. Fecha: 2026-10-12.

## Resultado

Implementación local del movimiento autónomo, marcas, controles, señalización sin
clic y práctica por texto visible. Sin dependencias nuevas, migraciones ni efectos
remotos. La documentación canónica está en
[acompañamiento visual](../../../../docs/architecture/autonomous-orb-guidance.md).

## Verificaciones ejecutadas

| Comando / escenario | Resultado |
|---|---|
| `npm run verify:pr` en el estado final | Correcto: 408 archivos de suite aprobados, 4257 pruebas aprobadas y 1 prueba omitida preexistente. Incluye typecheck, lint incremental, arnés, supply chain, documentos, semilla y OpenSpec. |
| `npx vite build --config vite.config.mts` | Correcto: renderer, main y preload. Conserva avisos de tamaño de chunks/importación dinámica. No genera instalador. |
| `node test/manual/orb-guidance/verify.cjs` con la fixture Vite | Correcto: orbe de 208×340 sin controles recortados, ambos temas, pausa, estilo, formulario local y ancho de 320 px; sin errores de página. |
| `node test/manual/orb-guidance/build-native.mjs` y ejecución del bundle con Electron instalado | Correcto: ventanas reales, movimiento sin cubrir objetivo, foco, marcas dibujadas, captura sin superficies propias, restauración, cierre y comando foreground del worker Windows. |
| Revisión adversarial independiente | Hallazgos corregidos y rutas finales confirmadas. |

La línea base `1505d2c` pasó con 4214 pruebas y una omitida. La primera ejecución
amplia del cambio detectó una etiqueta faltante para la herramienta nueva y un
fallo intermitente de limpieza de perfiles. Se añadió la etiqueta y se contrastó
la limpieza con una línea base independiente. La ejecución final pasó completa.

## Regresiones cubiertas

- Pausa/reanudación invalida la coordenada retenida y exige nueva observación.
- Detener sin señal externa bloquea efectos pendientes, incluida escritura tras un delay.
- Búsqueda, captura, render y comprobación tardíos no restauran operaciones canceladas.
- Cambio de estilo conserva caducidad y espera el render vigente antes de actuar.
- Clic semántico comprueba contexto y relocaliza antes de la entrada física.
- Cambio de bounds/handle en Windows cancela la coordenada previa.
- Campo deshabilitado o cubierto durante una indicación no recibe escritura.
- Arrastre deja pasar la entrada a la aplicación inferior; mouse_up no espera una pausa.
- IPC rechaza emisor ajeno, subframe, sesión ausente, campos extra y recetas inválidas.
- `orb:hide` verifica emisor/frame/sesión antes de cancelar tareas.
- Una práctica no avanza sin el texto de resultado y permite reintentar errores.

## Alcance de la prueba nativa

Windows y Electron real en un monitor. Geometría de origen negativo y recorte
entre monitores cubierta mediante pruebas puras. El piloto con monitores de
distinto escalado, aplicaciones específicas y capturadores de webinars queda
como QA de compatibilidad. UIA/OCR confirma presencia de texto, no aprendizaje ni
corrección semántica de datos. La captura puede producir un breve ocultamiento.

El estudio no transmite ni sincroniza recetas entre participantes. Su integración
multimedia y de servidor sigue siendo la dependencia descrita en la propuesta.

## Preservación del trabajo concurrente

El checkout inicial recibió merges de producción audiovisual durante el trabajo.
La implementación final se aisló en `.worktrees/autonomous-orb-guidance`, rama
`codex/autonomous-orb-guidance-implementation`, sobre `1505d2c`. Se conservaron
los cambios y el índice del checkout original. Los artefactos de QA permanecen
en `work/`, ignorados; no se versionan perfiles ni bundles generados.
