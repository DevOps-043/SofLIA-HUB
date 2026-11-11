# SofLIA Pro con GPT-6.1 Terra

El [catálogo del chat](../../../../src/hooks/model-selector-options.ts) incorpora
`gpt-6.1-terra` con cinco niveles de razonamiento y Medio como valor inicial.
La selección pasa por el ruteo OpenAI existente. La cuota de tres usos mensuales
corresponde a SofLIA Max. El catálogo de equipos en segundo plano admite Terra
para los trabajos nuevos y persistidos. La documentación oficial confirma el
identificador, los niveles y el uso de herramientas mediante Responses.
[OpenAI Docs](https://developers.openai.com/api/docs/models/gpt-6.1-terra)

## Verificación

- Antes de incorporar el modelo fallaron los tres casos que esperaban ver,
  seleccionar o recuperar SofLIA Pro.
- Después, `npm run test --` con las suites del catálogo, el selector, el
  navegador compacto, el ruteo, la cuota, el envío del chat y el IPC de OpenAI
  pasó 103 pruebas en siete archivos. El proveedor simulado recibió Terra y
  el esfuerzo elegido. También se comprobó el ruteo de Pro con la cuota de
  Max agotada y el rechazo de solicitudes IPC fuera del ámbito autorizado.
- Pasaron `npm run typecheck`, `npm run lint:changed`, `npm run harness:validate`,
  `npm run docs:check` y `npm run openspec:validate`.
- El caso de Terra en equipos fue rechazado por el catálogo anterior. Tras
  ampliar la lista permitida, pasaron las 43 pruebas de equipos y el caso
  comprobó la ejecución del trabajo y la recuperación con el mismo modelo.
- La primera compuerta se detuvo al resolver Python mediante el alias de
  Windows. Se verificaron las 33 pruebas con Python 3.12.14 y se repitió
  `verify:pr` usando `SOFLIA_TEST_PYTHON` por proceso. Pasaron las etapas previas
  a cobertura, incluidos los 65 contratos del tooling.
- Esa ejecución de cobertura había importado la lista anterior al ajuste de
  equipos. Terminó con 7411 pruebas aprobadas y un rechazo de Terra por esa
  lista. La comprobación final usa todos los archivos corregidos.
- Resultado final de `npm run test:coverage`, código 0. Pasaron 7412 pruebas
  en 627 archivos y se omitieron cinco pruebas en dos archivos. La cobertura
  verificó 2708 fuentes de producción, con 62.2% de líneas, 60.46% de
  sentencias, 57.1% de funciones y 53.9% de ramas.
- Tras el ajuste de equipos pasaron nuevamente typecheck, lint incremental
  y OpenSpec. Los 15 archivos de la entrega coinciden con el checkout activo,
  donde se conservaron los cambios de Live Studio existentes.

La validación del proveedor fue simulada. El acceso remoto depende del
proyecto de OpenAI configurado. Para revertir la opción se puede retirar su
entrada del catálogo. El selector usará SofLIA si encuentra un identificador
guardado que ya no está disponible. Se debe mantener Terra en la lista de
equipos mientras haya trabajos guardados con ese modelo.
