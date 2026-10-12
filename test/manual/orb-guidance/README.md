# Prueba visual aislada del orbe

Esta fixture usa los componentes reales con datos explícitamente de ejemplo y
un puente simulado. No carga `.env`, autentica usuarios ni ejecuta un agente.

1. Iniciar `npx vite --config test/manual/orb-guidance/vite.config.mts`.
2. Ejecutar `node test/manual/orb-guidance/verify.cjs`. Chrome puede indicarse con
   `SOFLIA_QA_CHROME`; capturas y resultados se guardan en `work/orb-guidance`.
3. Ejecutar `node test/manual/orb-guidance/build-native.mjs` y después
   `npx electron work/orb-guidance/native-smoke.cjs` con el servidor activo.

El smoke nativo crea ventanas propias y una partición de QA local, verifica el
movimiento y las marcas reales, comprueba el ocultamiento durante captura y
cierra sus recursos. No mueve el puntero ni escribe en otras aplicaciones. El
resultado está en `work/orb-guidance/native-result.json`; las imágenes capturan
únicamente documentos de la fixture, no el escritorio del usuario.
