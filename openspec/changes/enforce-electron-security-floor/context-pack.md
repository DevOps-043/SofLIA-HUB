# Contexto del cambio

- Objetivo: retirar Electron 44.5.1 afectado por GHSA-jr5w-w6x2-84p9 e impedir que la validación acepte un retroceso a rangos conocidos como vulnerables.
- Usuario o actor: build/CI y runtime Electron; sin capacidad nueva de agentes.
- Alcance: pin 44.9.3 en manifiesto/lock/instalación/binario, política de rangos con semver, runtime:stable dentro del gate PR, pruebas de excepción beta que no eluda seguridad y smokes nativos aislados de consumidores.
- No objetivos: explotar certificados reales, MITM, cambiar store de confianza del SO, APIs/IPC, resolver todo audit Node/Python, publicar o actualizar instalaciones desplegadas.
- Restricciones: preservar veintiuna unidades anteriores y worktrees, rama actual sin concurrencia. No leer secretos/.env, cuentas/perfiles reales, SQL ni release. Revisar hooks y lock antes de instalar; custodiar la instalación anterior en temporal para recuperación.
- Contratos afectados: verificación de dependencias y del ejecutable; main/preload/renderer conserva API. CI necesita poder ejecutar Electron en modo Node, sin GUI/perfil.
- Riesgo y HITL: runtime nativo y minor Chromium; smokes sobre perfiles temporales sin red externa ni login. Descargas de binarios verificadas; ningún despliegue/dispatch/push implícito.
- Criterios verificables: rangos afectados y metadata inválida rechazados; parches aceptados; excepción de prerelease no salta seguridad; metadata/lock/binario nuevos coinciden; comparación audit before/after sin afectados nuevos; servicios nativos relevantes, gate y build pasan con fuentes estables.
- Incertidumbres: los hashes prueban integridad respecto de la fuente, no todo el suministro; comprobar versión parcheada no reproduce ataque TLS. No hay certificación de instalador/otras plataformas ni nuevo porcentaje de deuda por número de tests.
