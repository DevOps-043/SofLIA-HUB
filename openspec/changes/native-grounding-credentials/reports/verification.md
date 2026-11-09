# Verificación de credenciales nativas de investigación

Fecha 2026-11-07. Verificación local aprobada. Las pruebas usan puertos,
credenciales, identidades y datos ficticios.

El wrapper y preload comparten un contrato de modelo, cuerpo e identificador.
Main rechaza un campo apiKey antes de consultar la credencial. El servicio pide
la clave a la autoridad Gemini dentro de la plaza física y la usa como header
sobre el endpoint fijo. La validación de emisor, esquema, herramientas, bytes y
cancelación conserva los canales existentes.

Pasaron 119 pruebas dirigidas en cinco archivos. Incluyen puente completo,
rechazo de credenciales inyectadas, cancelación durante clave pendiente, A/B/A,
retención de plaza, error público fijo, fuentes, gráficas, herramientas y modo
web. Otras siete verifican vinculación Lia y resolución de credenciales nativas.
La primera ejecución dirigida y el primer tipado detectaron una aserción antigua
que todavía consultaba apiKey en el DTO de prueba. Se corrigió el fixture y se
repitió la suite dirigida. La compuerta verifica el tipado del estado final.

## Revisión propia

Se revisaron los caminos de generación, cancelación y error. Una consulta de
credencial pendiente conserva la plaza aun cuando se responda al usuario por
cancelación. Al resolver, las guardas impiden iniciar HTTP. La revocación durante
transporte conserva las guardas existentes. El consumidor interrumpe los
reintentos entre sesiones y devuelve el estado detenido antes de continuar a
una acción o al fallback de lectura. Los fallos de credencial son terminales
para la investigación nativa. Los fallos de proveedor conservan los reintentos
de modelo dentro de la política de credenciales de main.

## Decisión de compatibilidad

La investigación Electron adopta la política común de Gemini nativo. Main usa
la configuración de entorno ante ausencia de clave personal. Si el proveedor
rechaza una clave personal, los modelos alternativos conservan esa credencial.
El modo web mantiene la selección de claves personales y de entorno. Chat general,
preparación por especialistas, fase de acciones y configuración pública siguen
pendientes de migración. La acreditación con proveedor real, revisión independiente
e integración de ramas siguen pendientes.

Logs, JSON y respaldos en `%TEMP%/soflia-native-grounding-2026-11-07/`.

## Resultado local

`npm run verify:pr` terminó con código 0. Pasaron 7062 pruebas y se omitieron 5.
El lint incremental revisó 726 archivos sin incidencias nuevas. Cobertura de las
2629 fuentes productivas: líneas 60.48%, sentencias 59%, funciones 55.43% y
ramas 52.41%. `npm run app:smoke:build` terminó con código 0 y conservó los
avisos de tamaño de fragmentos. La compilación aislada valida el build local.

La huella de rutas y bytes de producción coincide antes y después de la suite.
SHA-256 `91612c43cbc47d245200b7ca1ba72d857631c0f13df66eed07b59aa1235ebaa2`.
La revisión independiente sigue abierta en la tarea 1.4.
