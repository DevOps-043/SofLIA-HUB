## 1. Contratos e inventario

- [x] 1.1 Definir en `electron/desktop-context/types.ts` el adjunto de aplicación, el nivel de extracción, los avisos y los límites, con validadores compartidos.
- [x] 1.2 Implementar el inventario de ventanas candidatas reutilizando `DesktopWindowControls.listWindows` y `desktopCapturer` con `types: ['window']`, excluyendo Pulse Hub y ventanas sin título, y declarando los niveles disponibles por plataforma.
- [x] 1.3 Añadir la bandera de configuración que gobierna el registro de la capacidad y su rollback.
- [x] 1.4 Cubrir con pruebas main el inventario, la exclusión propia, el estado vacío y el fallo de enumeración.

## 2. Cascada de extracción

- [x] 2.1 Implementar el nivel A: resolución de rutas y estado de guardado de documentos Office abiertos por COM, de solo lectura, con verificación del nombre de archivo contra el título de la ventana y lectura posterior con el sidecar `documents.py`.
- [x] 2.2 Implementar el nivel B: extractor UIA por `hwnd` con `TextPattern`, en módulo propio, sin tocar `ui-elements-script.ts` ni alterar el primer plano.
- [x] 2.3 Implementar el nivel C: captura acotada de la ventana seleccionada a resolución legible, independiente de la miniatura del selector.
- [x] 2.4 Implementar el orquestador de la cascada con presupuesto de tiempo por nivel, degradación automática, truncado declarado y procedencia en la respuesta.
- [x] 2.5 Cubrir con pruebas main cada nivel, la degradación entre niveles, el documento sin guardar, la ruta que no coincide con la ventana y la ventana cerrada durante la extracción.

## 3. Electron e IPC

- [x] 3.1 Registrar el servicio y los handlers `desktop-context:list-apps` y `desktop-context:capture-app` con errores saneados y validación de entrada previa a cualquier PowerShell o COM.
- [x] 3.2 Completar allowlist de canales, API de preload y tipos globales.
- [x] 3.3 Añadir el wrapper tipado del renderer siguiendo el patrón de `src/services/integrated-browser-service.ts`.
- [x] 3.4 Cubrir handler, payload inválido, capacidad desactivada y saneamiento de errores con pruebas main y de preload.

## 4. Experiencia en el chat

- [x] 4.1 Añadir la entrada "Añadir aplicaciones" al menú de herramientas y el selector con miniatura, aplicación de origen, marcado múltiple y estados de carga, vacío y error.
- [x] 4.2 Añadir los chips de adjunto de aplicación con nivel de fidelidad, aviso de cambios sin guardar y quitado individual, conviviendo con los chips de pestañas.
- [x] 4.3 Extender el ensamblado de contexto del turno para aplicar el límite agregado compartido con las pestañas y declarar recortes y procedencia en el bloque entregado al modelo.
- [x] 4.4 Cubrir con pruebas renderer el selector, la convivencia con pestañas, el límite agregado, el fallo aislado de un adjunto y el envío sin bloqueo.

## 5. Documentación y cierre

- [x] 5.1 Actualizar `docs/architecture/backend-electron.md`, `docs/architecture/ipc-and-integrations.md`, `docs/product/functional-requirements.md` (RF-040), `docs/product/user-stories.md` (HU-026), `docs/product/decisions-and-limits.md` (LIM-020), `docs/product/traceability-matrix.md`, `docs/security/security-and-privacy.md` y `docs/quality/test-strategy-and-inventory.md`.
- [x] 5.2 Ejecutar pruebas focalizadas, `npm run typecheck`, lint del código cambiado, validación documental y validación OpenSpec.
- [ ] 5.3 Verificación manual en el host con Word, Excel, PowerPoint, un visor de PDF y una aplicación sin accesibilidad; registrar evidencia por nivel de la cascada. — MANUAL: requiere Office instalado y ventanas reales; no se puede automatizar en este entorno.
- [ ] 5.4 Ejecutar `npm run verify:pr` y revisión adversarial de privacidad, recursos, IPC, uso de COM y rollback; registrar riesgos residuales.

## 6. Desvíos respecto al diseño inicial

- [x] 6.1 La extracción pasó de ocurrir al enviar a ocurrir al marcar: el requisito de procedencia exige que el chip declare el nivel usado, y al enviar ya sería tarde para que el usuario actúe con esa información. `design.md` recoge el cambio y su motivo.
