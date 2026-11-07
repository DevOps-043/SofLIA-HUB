# Verificación de imagen Gemini en main

Fecha: 2026-11-03. Cambios locales; no se desplegó ni usó una cuenta real.

La ruta Electron utiliza el canal `ai:gemini-image`, un prompt acotado, modelo
fijo y credencial Google resuelta en main mediante la vinculación de sesión
existente. No se envía la clave por este canal. El navegador autónomo conserva
su ruta anterior. Las pruebas dirigidas cubren las cuatro capas, ventanas y
marcos no autorizados, sesión, navegación, cancelación, cuotas físicas, límites,
validación de salida y errores saneados. Proveedor y credenciales simulados.

`npm run verify:pr` terminó con código 0: 7019 pruebas aprobadas y cinco omitidas;
cobertura de 2622 fuentes: líneas 60.31%, sentencias 58.83%, funciones 55.24%
y ramas 52.26%. El build aislado anterior terminó con código 0. Una ejecución
previa de compuerta quedó sin resultado recuperable; se repitió completa. Los
registros y respaldos están en `%TEMP%/soflia-native-image-2026-11-03/`, con
`gate-resumed.log` y `build.log` como evidencia.

No se probó con Google o sesión reales, ni se acredita instalador o arranque.
La clave Gemini continúa accesible en otros usos del renderer y el main puede
incorporar claves de entorno al bundle. Un trabajo ya enviado al proveedor puede
seguir consumiendo recursos después de cancelar. La revisión propia no sustituye
una revisión independiente, que permanece pendiente; no se archiva el cambio.
No se recalculó el índice global de deuda ni se integró con otras ramas.
