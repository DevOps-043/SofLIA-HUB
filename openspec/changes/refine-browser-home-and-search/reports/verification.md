# Verificación

## Cambios y evidencia

- Portada sin cabecera, pie ni anillos; buscador ovalado y lupa en botón circular.
- Contenido y CSS estáticos compartidos entre React y el protocolo interno.
- Inicio interactivo antes de resolver `open`; sugerencias sin cambiar su viewport.
- Enter y flechas corregidos; hover no sustituye el destino y vacío no navega.
- El estado conserva el destino durante la carga y no revive la URL anterior.
- Favicon local para la portada, sin solicitarlo a Google.

## Perfil de la demora

Sonda temporal con perfiles aislados, sin bootstrap de la app, cuentas ni `.env`.
Una vista nueva con HTML vacío tardó 2.408 ms; con el documento completo, 2.392
ms; con bytes, 2.443 ms; con `data:` mínimo, 2.371 ms. Recargar una vista ya
abierta tardó 14–17 ms. Esto refuta que cambiar el cuerpo a bytes o quitar el
logo resuelva la espera. El renderer existente muestra la portada mientras se
prepara el proceso nativo, sin pool ni cambio de aislamiento.

La sonda ejecutó Electron 44.0.0-beta.3 / Chromium 152.0.7977.30 del entorno,
distinto al Electron estable declarado en package.json. No acredita el runtime
del instalador ni FPS visibles. El tiempo nativo en segundo plano se conserva
como límite; las pruebas de UI comprueban que no bloquea el buscador.

## Revisión adversarial

Se probaron espacios, caracteres especiales, hover sobre Google, selección
desde índice vacío, Escape, rerender durante escritura, viewport no booleano,
URL previa durante carga y composición nativa opcional. El HTML sólo procede
del build; ningún dato remoto o de usuario se interpola. La búsqueda del
renderer cancela el formulario de la ventana principal y usa el wrapper IPC.
El canal y allowlist existentes se conservan y main valida la geometría.

La prueba de rerender descubrió que recrear el objeto de HTML borraba el campo;
se fijó su referencia y se estabilizó el callback de navegación. La regresión
verifica identidad del input y texto conservado. No se archiva el cambio sin
la revisión independiente exigida para ese paso.

## Comandos

Pruebas dirigidas main: 259 aprobadas. Las pruebas renderer ampliadas y la
portada se comprobaron por teclado, con carga pendiente y durante rerender.

- `npm run verify:pr`: aprobado; 358 suites y 3.836 pruebas aprobadas, una
  omitida previamente. Incluye typecheck, arnés, contratos, docs y lint incremental.
- `npm run app:smoke:build`: aprobado en el estado final, sin `.env`, en
  `pulse-app-build-int55h`. No se generó ni instaló un instalador.
- `test/manual/browser-native/home.cjs` sobre ese build: aprobado. Cero
  solicitudes HTTP(S), script del documento bloqueado, movimiento reducido,
  ancho 320 y sin scroll innecesario en la ventana normal. Cambiar sólo
  `homeInShell` mantiene la URL y alterna correctamente la superficie nativa.
- [Resultado nativo](native-home.json): acuse de pestaña 4,81 ms. Su documento
  nativo tardó 2.353 ms en terminar; abrirlo por primera vez, 4.299 ms. La UI no
  espera esos tiempos: la regresión monta y usa el buscador antes de resolver
  `open`. No se presenta el acuse como tiempo hasta pintar.
- Revisión visual de [oscuro](home-dark.png) y [claro](home-light.png), capturados
  en compositor offscreen con el mismo contenido y CSS compartidos.

Los gestores de inicio también se verificaron sin captura ni ocultación. Las
páginas externas conservan el recorte anterior del desplegable. Las sesiones
que ya tenían Google se conservan; crear una pestaña sin destino usa SofLIA.
