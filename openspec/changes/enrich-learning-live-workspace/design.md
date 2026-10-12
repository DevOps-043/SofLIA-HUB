# Diseño del aula colaborativa

## Decisión

DEC-LIVE-V2-01: Hub presenta antesala y colaboración React; Learning valida identidad SOFIA y alcance académico en cada lectura/escritura. La apertura multimedia vuelve a autorizarse al pulsar Entrar. La política y consentimiento nunca dependen del renderer.

DEC-LIVE-V2-02: un canal IPC cerrado y una API HTTP versionada soportan comandos tipados. Los comandos llevan UUID de idempotencia; la transacción valida el actor, bloquea la sesión, aplica la operación y emite telemetría mínima si procede. No se reintentan mutaciones automáticamente.

DEC-LIVE-V2-03: FAQ exacta configurada y normalizada ofrece respuesta privada sin invocar IA. Las métricas de Pulse Checks son respuestas declaradas y no una inferencia de comprensión, sentimiento o desempeño. No se generan perfiles de RRHH desde chat.

DEC-LIVE-V2-04: IA y telemetría parten desactivadas. Una modificación de política incrementa versión e invalida consentimiento anterior. Revocar telemetría elimina los eventos propios pendientes; retención elimina datos vencidos. El acceso a clase sigue disponible sin consentimiento analítico.

## Límites

LIM-LIVE-V2-01: no se sustituye el cliente web Zoom ni su chat multimedia; la colaboración SofLIA es una superficie independiente. Una solicitud de ayuda etiqueta la sala declarada por el alumno, sin afirmar membresía Zoom.

LIM-LIVE-V2-02: RTMS exige app, scopes, créditos, correlación de participantes y consumidor WebSocket persistente. LTI exige un proveedor/registro OIDC y JWKS; no se aceptan URLs arbitrarias ni iframes con privilegios. Computer Use debe reutilizar las guardas HITL del agente de escritorio y no operar en pestañas Zoom sensibles. Integraciones corporativas requieren conexiones y autorización de envío propias.

## Transporte

`learning-live:workspace` envía referencia académica y operación al endpoint fijo `/api/auth/live/workspace`. El bearer permanece en main. Entrada 32 KiB, salida 512 KiB, timeout 15 s, redirects bloqueados, comprobación de identidad tras respuesta. Lectura periódica cancelable cada 10 s, sin solapamiento, pausa al ocultar, backoff hasta 60 s. Salida pública sin URL Zoom ni credenciales.
