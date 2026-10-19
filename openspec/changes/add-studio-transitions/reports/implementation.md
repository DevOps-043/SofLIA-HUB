# Transiciones y programa continuo

Fecha: 2026-10-14. Rama de trabajo: `codex/studio-transitions`.
Estado: implementación y verificación local completas; ensayo SDK real pendiente
de configuración externa, sin archivo del cambio ni despliegue.

## Entrega y decisiones
Investigación y alcance en [diseño](../design.md). OBS distingue escenas de espera
y efectos, además de previo/programa. StreamYard prepara agrupaciones de escena;
Ecamm anima sus composiciones. Hub adopta separación de previo/programa, cuatro
efectos y cuatro momentos del curso sin depender de OBS ni agregar librerías.

El banco mantiene 12 escenas y puede contener pantallas personalizadas, reloj,
láminas, capturas con consentimiento y archivos. Preparar salida crea un programa
continuo de video. Se entrega mediante peer local a un receptor aislado y la
llamada captura ese WebContents, sin paneles ni identidad de Learning. La llamada
conserva su micrófono y cámara; los videos de programa no incluyen audio.

La salida local no se presenta como emisión. Se bloquea su preparación mientras
se comparte directamente otra fuente, para no atribuir esa pista anterior al
programa nuevo. Se debe compartir desde el control oficial de la llamada.
El modo directo conserva su funcionamiento al cerrar programa.

## Evidencia ejecutada
- OpenSpec: propuesta, contexto, diseño, dos especificaciones y tareas validados.
- Regresión inicial de instructor y estudio: 34 pruebas en 5 archivos, exitosas.
- Salida, compositor y UI: 14 pruebas en 3 archivos, exitosas; se añadió y pasó
  posteriormente un caso de destino que falla durante el dibujo (5 casos del compositor).
- `node scripts/quality/smoke-studio-program.mjs`: exitoso repetido después de
  restauración de throttling. Chromium real recibe rojo, verde y azul, conserva
  ID/pista viva durante fundido y barrido y usa el receptor separado de la UI.
  Muestras recibidas: [255,1,0,255], [0,255,1,255], [1,0,255,255].
  El receptor expone solo answer/offer/state, sin APIs generales ni Learning.
- UI en localhost:4321: revisadas plantillas, selección de Receso, cuenta previa
  05:00 y controles de efecto/duración/preparación en modo claro. La fixture web
  no tiene API nativa de salida; la emisión se verifica con el smoke Electron.
- Lint incremental intermedio: 26 archivos sin deuda nueva.
- Verificación dirigida final: 48 pruebas en 7 archivos, exitosas.
- `npm run verify:pr`: exitoso. 433 archivos de prueba aprobados y 2 omitidos;
  4410 pruebas aprobadas y 5 omitidas. Tipos renderer/main, lint incremental,
  arnés, adaptadores, cadena de suministro, semilla, sistema documental, enlaces
  y 68 cambios OpenSpec aprobados. Incluye el trabajo ajeno presente en checkout.
- Documentación: enlaces válidos en 548 documentos, arnés y sistema válidos.
  Cifras IPC derivadas de arrays; inventario actualizado por docs:inventory:sync.

## Hallazgos corregidos y revisión adversarial local
Se aplicó la revisión de fallos, permisos y estados parciales de adversarial-review:
- Zod podía detectar eval antes de inyectar CSP y generar código después: parseo
  jitless en los límites nuevos del renderer; la CSP se conserva intacta.
- Preparar programa con pantalla directa viva producía un estado engañoso: bloqueo
  con instrucción de detenerla primero. No se altera una llamada por elegir tarjeta.
- El lienzo se podía pausar en segundo plano: se desactiva throttling solo durante
  salida y se restaura el valor anterior al cerrar.
- Un destino podía fallar al dibujar durante un efecto: se descarta y libera,
  rechaza el cambio y conserva el programa anterior, con restauración del contexto.
- Revisados frame/ventana exactos, actor cambiado, UUID, SDP limitado, campos extra,
  negociación vencida, crash, navegación y cierre. No se envían datos a Learning.
- Revisada limpieza de peers, canvas/pistas, fuentes salientes y concesión de salida;
  no se activa cámara, micrófono ni otra fuente al expirar un reloj.

Los primeros workers renderer agotaron su plazo de arranque mientras había otras
verificaciones locales en ejecución. Se repitió de forma serial con maxWorkers=1
y se registraron resultados reales; no se consideró ese fallo un éxito funcional.
Se detectaron trabajo ajeno de cierre de navegador y su OpenSpec en el checkout;
se preservaron. La compuerta general observa ese estado compartido.

## Límites y reversión
El smoke usa el mismo handler nativo de captura, pero una página local en lugar
del Meeting SDK autenticado. No acredita ingreso o recepción por alumno real:
requiere completar las credenciales SDK en Learning y ensayar con dos cuentas.
No se incluye mezcla de audio, cámara dentro del canvas, stingers de video ni persistencia
de bancos. WebRTC local implica una codificación/decodificación adicional; se acota
a 720p/30 fps, sin benchmark ni garantía de rendimiento en todos los equipos.

Reversión: cerrar salida y usar captura directa. Revertir únicamente archivos de
este cambio si se retira la capacidad; no requiere migración ni borrar datos.

## Ampliación: imágenes y pantallas como intermedio
Se incorporó el efecto Imagen o pantalla. Reutiliza imágenes locales, láminas y
pantallas vinculadas del banco durante 500–10000 ms (1500 por defecto), con
fundidos de hasta 200 ms. En movimiento reducido conserva duración con cortes.
Se prepara junto al destino, conserva programa si falla, libera intermedio y
saliente al terminar y cancela las tres fuentes al cerrar. El reloj comienza al
aparecer, por lo que cargar el intermedio no consume la cuenta del destino.

La interfaz usa tokens de tema, miniatura, campos compactos, acción principal
única y ayuda desplegable. Añadir visual selecciona el contenido creado sin
alterar la vista previa elegida ni publicar. El selector excluye videos y el
editor rechaza videos incluso si se fuerza su archivo. Se protege la eliminación
del intermedio elegido. Se puede mantener cualquier imagen/pantalla indefinida
pasándola como escena con corte, fundido o barrido.

Evidencia de ampliación:
- 18 pruebas dirigidas en dos archivos aprobadas: intermedio, duración, pista,
  movimiento reducido, fallo, cancelación, carga tardía, consentimiento de pantalla,
  archivo de video rechazado, creación/selección y protección de eliminación.
  La carga de pantalla se aborta y libera su captura al cerrar, sin esperar timeout.
- Smoke nativo aprobado con imagen PNG real de 16:9: rojo [255,1,0,255], verde
  [0,255,1,255], azul [1,0,255,255], imagen amarilla [254,255,0,255] y destino rojo
  [255,1,0,255]. Misma pista y receptor aislado confirmados.
- La primera muestra de una imagen cuadrada y tomada a 800 ms no cumplió el
  color esperado. La fixture se corrigió a 16:9 y muestra al centro de un intervalo
  de 4 s para verificar el contenido completo sin confundir encuadre o fundido.
- UI real local: importar Icono.png, selección automática y destino conservado;
  revisados miniatura, contraste y distribución en temas claro y oscuro y en
  ventana de 390 × 844, sin desbordamientos en los controles nuevos.
- Sin cambios IPC, dependencias, secretos, configuración local ni persistencia.

Revisión adversarial de la ampliación:
- Una captura esperando su primer cuadro podía seguir activa hasta el timeout
  después de cerrar salida. Se agregó AbortSignal en la preparación, se liberan
  video/captura y se rechaza la carga; cubierto por una prueba negativa.
- El timestamp de un frame podía preceder al inicio del cambio. Se acota el tiempo
  a cero para evitar alpha negativo en el fundido inicial; cubierto con ambos
  modos de movimiento.
- Revisados ownership del destino/intermedio, carga tardía, fuente configurada
  eliminada, destino igual al intermedio, campos extra y límites del esquema.
  Las pantallas usan el vínculo existente y concesión de vista previa (probado
  con mocks); el smoke nativo verifica composición y captura del receptor.

La primera compuerta de ampliación obtuvo 4420 pruebas aprobadas y un fallo en
`integrated-browser-service.test.ts`: limpieza del perfil temporal al cerrar,
fuera del alcance de transiciones. La repetición aislada del archivo aprobó sus
242 pruebas sin cambios de código. Se repitió la compuerta con
`$env:VITEST_MAX_WORKERS = '1'; npm run verify:pr` para evitar concurrencia de
workers durante la comprobación. No se modifican `.env`, scripts ni la suite del
navegador. Su trabajo ajeno continúa preservado.

Resultado final: `verify:pr` aprobado con un worker: 433 archivos aprobados,
2 omitidos; 4421 pruebas aprobadas y 5 omitidas. Se aprobaron también tipos,
lint incremental (26 archivos), arnés, adaptadores, cadena de suministro,
documentación de sistema (494 canales / 600 archivos de prueba), enlaces
(549 documentos), semilla y los 68 cambios OpenSpec. La ejecución paralela
original mantiene la incidencia intermitente descrita arriba; no se presenta
esa primera ejecución como aprobada. El smoke nativo volvió a aprobar después
de las correcciones de cancelación y tiempo inicial. La pestaña de QA y su
servidor temporal quedaron cerrados. No se creó commit, PR ni despliegue.
