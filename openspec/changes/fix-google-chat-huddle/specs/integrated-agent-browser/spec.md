## ADDED Requirements

### Requirement: Compatibilidad gobernada de Huddle
El navegador SHALL permitir el flujo nativo de llamada de Google Chat y MUST
preservar sus ventanas, sesión y permisos sin crear reuniones por iniciativa
propia. Este requisito sustituye el rechazo de llamadas del cambio activo
`evolve-integrated-browser-workspace`, autorizado por el usuario el 2026-10-06.

#### Scenario: Componente embebido de llamada
- **WHEN** Gmail o Chat carga o redirige un subframe HTTP(S) de Meet
- **THEN** el navegador permite la carga bajo su política de red y no cancela
  el componente por coincidir con la ruta `/call`

#### Scenario: Ventana nativa de llamada
- **WHEN** Gmail o Chat solicita una ventana para el destino HTTPS exacto
  `meet.google.com/call` o `/call/` permitido por la política del navegador
- **THEN** recibe una ventana real gobernada con sesión heredada y relación con
  el abridor, sin conversión a pestaña ni sustitución por otra reunión

#### Scenario: Ventana vacía que publica el destino
- **WHEN** una ventana gobernada de Google carga `/call` después de `about:blank`
- **THEN** conserva su instancia y está sujeta a navegación, certificados y
  permisos normales sin cierre especial por tratarse de una llamada

#### Scenario: Destinos ajenos o bloqueados
- **WHEN** el destino usa un protocolo peligroso, está bloqueado por la empresa
  o no coincide exactamente con la ruta reconocida de llamada
- **THEN** conserva la política general de bloqueo o pestañas y no recibe una
  excepción por usar un nombre parecido a Google Meet

#### Scenario: Inicio y permisos humanos
- **WHEN** la persona inicia Huddle desde el control de Google
- **THEN** el navegador permite el flujo nativo y conserva permisos de cámara y
  micrófono por origen; ninguna lógica de SofLIA crea reuniones por temporizador,
  restauración, detección de frames, fallback o sondas sobre el botón

#### Scenario: Permiso multimedia denegado
- **WHEN** el sitio solicita un dispositivo denegado por la persona o el sistema
- **THEN** la captura sigue rechazada sin permisos globales ni excepciones de Meet

#### Scenario: Capacidad de ventana incompleta en Electron
- **WHEN** el sitio consulta capacidades de las vistas del navegador
- **THEN** DocumentPictureInPictureAPI no se anuncia mientras no materialice una
  ventana gobernada en Electron; el sitio puede usar ventanas o paneles compatibles
  y la API de Picture-in-Picture de vídeo conserva su configuración normal
