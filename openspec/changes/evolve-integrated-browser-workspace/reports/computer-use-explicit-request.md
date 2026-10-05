# Corrección de solicitudes explícitas de Computer Use

Fecha: 2026-10-03.

## Diagnóstico

El chat visible de SofLIA Max afirmaba que `use_computer` no estaba disponible
después de recibir «ayudame a crearlo usa el computer use para hacer». La
heurística de intención no reconocía el nombre de la capacidad. El turno se
enviaba a OpenAI con `computerUseEnabled: true` y `useToolLoop: false`, por lo
que el catálogo no incluía las herramientas locales.

Antes de corregirlo fallaron tres regresiones: la frase reportada, una solicitud
explícita con captura del navegador y una solicitud que además pedía noticias.
En los tres casos el bucle de herramientas estaba deshabilitado.

## Implementación y revisión

- La petición explícita por nombre habilita la señal de acción y el bucle de
  herramientas, incluso con una observación de página o investigación web.
- Se corrige la negación histórica de acceso sólo cuando el catálogo efectivo
  contiene `use_computer`.
- Se conservan el aislamiento de extractos adjuntos, la selección de
  herramientas de la Skill y las confirmaciones existentes.
- Las consultas «cómo usar» y las negaciones no se interpretan como órdenes.
- Las pruebas cubren ambos proveedores, bridge ausente y catálogo restringido.
  El pipeline OpenAI publica la función, despacha sus argumentos y devuelve al
  modelo el resultado del ejecutor mediante `function_call_output`.

La primera prueba real, ya con herramientas, llamó a `use_computer` pero acabó
bloqueada con «La página, el perfil o el permiso cambió». La apertura no esperaba
que el renderer dibujara los controles de supervisión y publicara la geometría
actual. Además, republicar bounds idénticos invalidaba la captura después del
intervalo de entrada; cambiar bounds dentro de ese intervalo podía conservar
coordenadas obsoletas. Cuatro nuevas regresiones confirmaron esos fallos.

Main espera ahora el acuse de viewport de la apertura supervisada. El renderer
lo publica en el siguiente frame y cancela ese frame al desmontarse. Bounds
idénticos conservan la captura y todo cambio real la invalida inmediatamente.
Se reutiliza el evento existente, sin ampliar la superficie IPC.

No se modificaron credenciales ni canales IPC. Se conservaron
los cambios anteriores del usuario y del selector de Max en el mismo checkout.

## Verificación

- Pruebas focalizadas: seis archivos y 76 pruebas exitosas.
- Pruebas de navegador, driver, loop y supervisión: seis archivos y 287 pruebas
  exitosas después de corregir la coordinación de geometría.
- Revisión adicional: se cubrieron el fallo síncrono del aviso de apertura
  (retira la espera y libera control) y un workspace activo sobre extractos
  (no anuncia Computer Use). Las dos suites ampliadas pasaron 236 pruebas.
- La prueba del pipeline utiliza SDK y ejecutor simulados; no demuestra por sí
  sola el acceso remoto de la cuenta ni una acción real del navegador.
- Compuerta final `npm run verify:pr`: exit 0. Pasaron adaptadores, arnés,
  cadena de suministro, documentación, semilla de Skills, 28 cambios OpenSpec,
  typecheck, lint incremental (19 archivos) y 3489 pruebas en 321 archivos.
- `git diff --check`: exit 0.

## Prueba real y límite de QA

Se envió un único mensaje de diagnóstico desde SofLIA Max pidiendo observar
una vez el título del Libro de apuntes, sin crear, editar ni enviar datos ni
continuar la integración anterior. La respuesta confirmó la llamada real al
actuador y reportó el bloqueo de contexto; ese resultado motivó la corrección
de geometría y las cuatro regresiones previas al arreglo.

Después de recargar Electron, la herramienta externa `computer-use` devolvió
capturas de otra aplicación pese a seleccionar la ventana de SofLIA. La
recuperación del destino y el reinicio de la sesión JS no corrigieron esa
discrepancia. Se detuvieron las acciones de UI. No se completó una segunda
observación real con el arreglo final, por lo que no se afirma que la ejecución
remota final haya sido verificada visualmente.
