# Contexto del cambio

- Objetivo: retirar persistencia OAuth en texto plano y separar conexiones por sesión del Hub.
- Actor: usuario autenticado del Hub; Gmail, Drive y Chat conservan el cliente OAuth compartido.
- Alcance: almacén cifrado asíncrono por usuario, protección del archivo heredado sin perder registros, restauración y ciclo de vida frente a cambios de identidad, renovación y polling obsoletos.
- No objetivos: backend de claves compartidas, nuevos scopes OAuth, cambios de proveedores o despliegues; no inspeccionar credenciales reales.
- Contratos: conservar canales y DTO públicos; persistencia privada versionada, errores seguros y cierre de recursos.
- Restricciones: rama existente con dos bloques verificados; conservar todo ese trabajo. No copiar secretos ni usar fallback plano/basic_text.
- Riesgo/HITL: transformación local recuperable sin eliminar credenciales; los registros heredados sin propietario no se asignan al usuario actual y requieren reconexión OAuth explícita. No ejecutar la migración sobre un perfil real durante desarrollo.
- Criterios: cifrado efectivo con secretos ficticios en pruebas, escrituras atómicas/serializadas, A/B/A y logout sin resultados/tokens viejos, propietarios discordantes rechazados, fallo de cifrado sin escritura plana, disconnect sin resurrección desde legado, pruebas y gate completos.
- Incertidumbres: protección depende del usuario/llavero del SO; no aísla frente a otro proceso con los mismos privilegios de Windows. Las solicitudes remotas ya enviadas no son reversibles por logout.
