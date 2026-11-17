# Diseño

Este cambio sustituye la decisión de consentimiento exclusivamente efímero de
`secure-local-voice-authorization`; conserva sus barreras de caller, grants
activos, eventos dirigidos y permisos por alcance.

- Reutilizar el instalador Python con SHA256 fijado, staging y validación de
  imports. La app invoca exclusivamente ese entrypoint fijo en un hijo sin shell.
  En desarrollo instala en python-runtime; empaquetada repara en userData, sin
  escribir en resources ni modificar Python del sistema.
- Distribuir inputs fijos del preparador con el instalador. Usar Python incluido
  si existe, y resolver el reparado sólo como alternativa.
- Preparación compartida por promesa; init la inicia en segundo plano. Captura
  espera y revalida caller/señal después de cada espera. No hay grant implícito
  por instalar archivos. El modelo pequeño se instala sin activar escucha.
- Consentimiento local versionado con archivo por hash de cuenta y firma exacta
  de configuración. Sólo confirmación humana satisfactoria lo crea. Logout y
  A/B/A revocan grants activos; una nueva llamada puede recuperar exclusivamente
  la aprobación correspondiente al usuario actual. Detener/deshabilitar elimina
  su aprobación recordada. No se migra enabled a permiso.
- Mantener canales existentes y DTO sin rutas del host, agregando estado opcional
  de preparación. Reintentar instalación desde una acción explícita, sin bucles.
- Riesgos: primera preparación requiere red y puede tardar varios minutos; una
  instalación ya iniciada puede terminar después de cancelar. Nunca autoriza
  captura tardía. No cambia la política existente de integridad del modelo Vosk.
- Reversión: revertir conjuntamente código, UI y recursos de empaquetado; los
  archivos instalados no requieren borrado y los permisos recordados se ignoran.
