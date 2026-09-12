# Verificación de navegación segura — 2026-09-05

Estado: evidencia histórica parcial, complementada por la [revisión posterior](verification-browser-boundaries-2026-09-05.md).
Se reabrieron 5.4/5.5 por falta de avisos visibles y cobertura remota completa;
también se corrigió la aceptación de certificados para conservar Certificate Transparency.

## Alcance

Se añadió una revisión local determinista antes de cargar destinos del
navegador. Bloquea credenciales incrustadas, protocolos no permitidos y hosts
de `BROWSER_SAFE_BROWSING_BLOCKED_HOSTS`; avisa sobre HTTP público y dominios
codificados. El proveedor remoto es opcional mediante
`BROWSER_SAFE_BROWSING_ENDPOINT`, usa timeout acotado y recibe únicamente
protocolo, host y puerto.

## Evidencia

- `electron/integrated-browser/safe-navigation.ts`: contrato cerrado, lista
  local, proveedor remoto y degradación segura.
- `electron/integrated-browser/service.ts`: revisión antes de navegación y
  bloqueo local de ventanas emergentes convertidas en pestañas, descargas y
  reintentos; certificados no verificados se rechazan sin bypass.
- `electron/__tests__/integrated-browser-safe-navigation.test.ts`: bloqueo,
  advertencias, redacción del payload remoto y caída del proveedor.

## Verificación ejecutada

```text
npm run typecheck
npm run test -- electron/__tests__/integrated-browser-safe-navigation.test.ts electron/__tests__/integrated-browser-feature-flags.test.ts --run --maxWorkers=1
```

Resultado: typecheck aprobado; 2 archivos y 8 pruebas aprobadas.

## Límites

No se incluye una lista mundial de reputación ni se afirma detectar malware.
El proveedor remoto sólo se usa cuando el administrador configura un endpoint
HTTPS (o HTTP de loopback para desarrollo); un timeout o respuesta inválida
conserva la decisión local y no bloquea por indisponibilidad externa.
