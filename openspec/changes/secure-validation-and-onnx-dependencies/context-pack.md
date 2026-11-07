# Contexto del cambio

- Objetivo: disminuir avisos de dependencias sin romper validación de contratos ni inferencia CPU del parser visual.
- Usuario o actor: callers IPC con payload no confiable, usuario del agente de escritorio y tooling que instala binarios ONNX.
- Alcance: Zod raíz 4.6.7 y ONNX Runtime 1.30.0 con cierre compatible; revisión del lock/hooks, pruebas reales de colecciones acotadas, ZIP e inferencia local, gate/build y evidencia.
- No objetivos: cambiar schemas/scopes/IPC, instalar modelos OmniParser o CUDA, forzar Zod 3 a 4 dentro de Jimp, modificar secretos, desplegar/publicar o certificar otras plataformas.
- Restricciones: preservar las 23 unidades y cambios existentes; misma rama actual sin concurrencia física; no ejecutar hooks generales ni ZIPs que puedan asignar recursos excesivos en main.
- Contratos afectados: versiones/resolución del manifiesto/lock y binarios N-API; contratos públicos, renderer/preload y comportamiento funcional permanecen iguales. Pruebas de regresión cubren los consumidores originales.
- Riesgo y HITL: actualización de nativo con compatibilidad a demostrar; instalación revisada en checkout y QA local con fixtures propios, sin cuentas, modelos externos o control del escritorio. No se requiere autorización adicional para este cambio reversible.
- Criterios verificables: versiones físicas coherentes; cierre revisado sin nuevas dependencias afectadas; Zod acotado evita validar hijos fuera de cuota y conserva schemas; extracción ZIP legítima y rechazo controlado; inferencia CPU con modelo mínimo local, parámetros y cajas del parser visual; gate/build con fuentes estables y límites declarados.
- Incertidumbres: disponibilidad nativa por plataforma y regresión del detector real no se deducen del fixture. Zod 3 de Jimp y avisos restantes siguen pendientes. El índice experto global requiere reauditoría, no resta de avisos.
