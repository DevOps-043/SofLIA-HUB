# Motor de voz incluido y firmado

## Problema
Windows bloqueó _socket.pyd sin firma durante la preparación local de Python.
Descargar o reconstruir automáticamente el runtime en el equipo del usuario no
resuelve la confianza de sus componentes. El modelo básico tampoco se distribuía.

## Cambio
Preparar y firmar el motor en build, incluir Vosk básico y todos los componentes
de reconocimiento, verificar cada PE, firmar instaladores y distribuir reparación
autocontenida firmada. Configurar Azure Artifact Signing o certificado del almacén
de Windows, sin secretos en el repositorio. Publicación falla cerrado sin identidad.

La firma reduce bloqueos por editor desconocido; no anula políticas empresariales
ni garantiza reputación SmartScreen inmediata.
