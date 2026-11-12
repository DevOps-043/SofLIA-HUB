# Rostro luminoso — 12 de noviembre de 2026

La captura del usuario muestra señales azul oscuro sobre el visor. La causa
confirmada es `--color-accent`: en tema claro resuelve al azul de las acciones
de interfaz. El personaje usaba ese mismo token para sus expresiones.

Se definieron tokens propios del visor en el tema compartido: cian claro para
las señales y ámbar claro para advertencias. Se reforzaron los trazos de boca,
cejas y gestos pequeños, y la opacidad mínima durante sus pulsos. El cuerpo,
los recursos aprobados y el controlador de movimiento conservan su diseño.
El inicio nativo consume los mismos tokens y CSS.

La corrección equivalente está en la rama `codex/academy-avatar-2d` de Academy.

## Verificación

- Hub: 71 pruebas aprobadas en cinco archivos, incluyendo el documento nativo.
- Academy: 75 pruebas dirigidas aprobadas en doce archivos y seis verificaciones
  de navegador sin errores, con voz local, temas claro/oscuro y ancho de 390 px.
- Hub: typecheck, lint incremental y enlaces documentales aprobados.
- `verify:pr` se ejecutó y se detuvo en el inventario documental preexistente:
  declara 716 archivos (246 renderer), mientras el validador cuenta 715
  (245 renderer). Este ajuste visual no añade ni retira archivos de pruebas.
  No se declara aprobada la compuerta global.
- Chrome: 14 expresiones verificadas en dos temas y con movimiento reducido.
  El color calculado del SVG permanece cian o ámbar incluso cuando el acento
  de interfaz es azul oscuro. [Resultados](browser-qa.json),
  [tema claro](light.png) y [tema oscuro](dark.png).

Para reproducir desde la raíz, iniciar la fixture con:

```powershell
node node_modules/vite/bin/vite.js --config test/manual/soflia-avatar/integration.vite.config.mts --port 4333
```

En otra terminal:

```powershell
node test/manual/soflia-avatar/verify-contrast.mjs
```

Revisión adversarial local: se comprobó el tema claro que originó la regresión,
el documento nativo con CSP, los símbolos de advertencia y las expresiones
pequeñas. No hay cambios en permisos, voz, persistencia ni captura de micrófono.
La reversión se limita al commit de contraste, sin migraciones ni cambios de datos.
