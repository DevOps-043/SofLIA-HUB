# Contexto del cambio

- Objetivo: disminuir deuda de seguridad/correctitud del control GUI heredado.
- Actor: operación Computer Use admitida bajo sus guardas de entrada existentes.
- Alcance: mouse/teclado en tres plataformas, transporte de datos separado de código,
  ejecución acotada/cancelable, OCR Tesseract 7 y lease de sesión durante esperas.
- No objetivos: ejecutar GUI real, sustituir Desktop Agent/nut.js, custodiar claves,
  probar permisos/macOS Intel ni autorizar rutas runtime sin sus políticas propias.
- Restricciones: sin GUI o vista nativa, secretos/.env, índice, dependencias o
  cambios ajenos. Usar rama activa por unidades anteriores sin commit; backup TEMP.
- Contratos: mantiene acciones/canales y cuatro capas; contexto interno opcional
  main para propagar fuente. Keys aceptan combinaciones explícitas, no scripts.
- Riesgo/HITL: aprobación de unidad 42 sigue obligatoria; nada de ejecución real
  de mouse/teclado en esta evaluación. Datos nunca se concatenan en shell/código.
- Criterios: pruebas causales, tres backends con puertos simulados, texto hostil,
  caracteres especiales, teclas, timeout/salida/cierre físico, OCR y revocación;
  compuerta/cobertura/build con fuentes estables.
- Incertidumbres: prueba de puertos no acredita entrada física del SO. Cierre de
  proceso no revierte eventos enviados. Revisión independiente pendiente.
