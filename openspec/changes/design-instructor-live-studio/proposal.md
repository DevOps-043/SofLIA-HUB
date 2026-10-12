# Estudio del instructor para sesiones síncronas

## Why
El instructor necesita conducir una clase desde una vista distinta a la del participante. El usuario pide comenzar por un diseño de frontend inspirado en la distribución de Twitch, OBS y los controles de Zoom.

## What Changes
- Estudio con chat y estadísticas a la izquierda, vista previa y escenas al centro, actividades y recursos a la derecha y barra flotante de medios.
- Insignia de instructor, comandos de chat, moderación, reacciones e interacción SofLIA, todos como estados locales de diseño.
- Configuración visual de salas, quizzes, archivos/lecturas, temporizador, cronómetro y dispositivos.
- Separación de vistas por `can_manage` del contrato existente; la vista del participante conserva su lienzo independiente.
- Fixture con datos explícitos de ejemplo y acceso directo al diseño del instructor.

## Impact
Solo frontend React y documentación. Sin cambios de IPC, permisos Zoom, backend, persistencia ni despliegue. Los controles del prototipo no transmiten ni moderan una sesión real.
