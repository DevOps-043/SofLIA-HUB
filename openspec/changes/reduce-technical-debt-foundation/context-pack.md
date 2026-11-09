# Contexto del cambio

- Objetivo: reducir deuda confirmada sin romper integración ni contratos existentes. Primera entrega local del programa, no cierre de todas las áreas.
- Actor: desarrollo, operador de publicación y usuario autenticado del calendario.
- Alcance: ESLint reproducible, publicación verificada y build Linux canónico, frontera IPC de calendario tipada/validada con HITL, errores seguros y eventos sin credenciales, correcciones de documentación.
- No objetivos: desplegar SQL, publicar, rotar secretos, retirar las claves compartidas sin un backend sustituto, migrar todo el navegador o actualizar dependencias masivamente. Cada área restante tiene secuencia y criterios en el plan.
- Restricciones: preservar modularidad main/preload/renderer, canales existentes, UI en español y trabajo ajeno. No modificar .env, instalar software ni ejecutar APIs reales.
- Contratos: calendario existente conserva nombres y argumentos posicionales; normalización explícita en wrapper renderer. YAML de CI/release y configuración ESLint.
- Riesgo/HITL: mutaciones del calendario solicitan confirmación nativa contextual, negada al cancelar/cambiar sesión/ventana/marco o vencer. No se ejecutan mutaciones remotas para probar.
- Criterios: casos positivos y negativos de emisor, schemas, concurrencia, cambio de sesión y redacción; tipos, lint incremental sin fallos de parser ocultos, suite y compuertas documentadas.
- Incertidumbres: producción/RLS y secretos compartidos requieren migración posterior con backend y verificación autorizada; fallos históricos de pruebas se separan de regresiones. Umbral solicitado interpretado como deuda <=5%, sin áreas del diagnóstico en ese rango.
