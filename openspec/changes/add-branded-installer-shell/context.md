# Contexto del cambio

- Objetivo: reemplazar la ventana convencional, no volver a decorar sus páginas.
- Usuario o actor: persona que instala Pulse Hub en Windows x64.
- Alcance: ventana WPF propia, logo original, componente React/Three.js original en WebView2 local, interacción y accesibilidad, motor NSIS silencioso embebido, empaquetado y pruebas.
- No objetivos: despliegue, firma, instalación real sobre el equipo del usuario, migraciones, nuevo actualizador o descarga de motores gráficos.
- Restricciones: conservar cambios existentes en el worktree dedicado; no modificar secretos. Python privado permanece dentro del paquete existente.
- Contratos afectados: nuevo EXE de entrada Install.exe; Setup.exe y latest.yml mantienen su identidad para actualizaciones.
- Riesgo y HITL: instalar requiere clic explícito; no matar la instalación durante escritura; no abrir la aplicación automáticamente. Verificar SHA-256 del payload antes de ejecutarlo; no aceptar ejecutables externos.
- Criterios verificables: ventana no NSIS, imagen original embebida, escena animada con reducción de movimiento, estados derivados de bytes/ejecución/resultado, rechazo de payload corrupto, previsualización incapaz de instalar, compilación reproducible.
- Incertidumbres: firma y ciclo de instalación/actualización/desinstalación requieren validación de release en Windows desechable. WPF exige .NET Framework disponible; no se descarga silenciosamente.
