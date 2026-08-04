## 1. Backend de intercambio

- [x] 1.1 Implementar el núcleo comprobable que valida bearer token, identidad SOFIA, membresía activa y generación del token Lia
- [x] 1.2 Implementar la Edge Function con CORS, respuestas no cacheables, clientes SOFIA/Lia separados y errores seguros
- [x] 1.3 Versionar la configuración `verify_jwt = false` y la guía de secretos/despliegue sin valores sensibles

## 2. Cliente y sesión

- [x] 2.1 Implementar el servicio renderer que obtiene el JWT SOFIA, invoca el intercambio y canjea el token de un solo uso
- [x] 2.2 Sustituir inicio/alta/reparación Lia por contraseña por restauración e intercambio automático
- [x] 2.3 Integrar la misma ruta en inicio, restauración y reintento sin cerrar SOFIA ante fallos transitorios

## 3. Experiencia de usuario

- [x] 3.1 Retirar estado, formularios y textos de reparación técnica de credenciales
- [x] 3.2 Mostrar un estado simple de conversaciones no disponibles con acción de reintento

## 4. Evidencia y documentación

- [x] 4.1 Probar autorización del backend, conservación de identidad, no uso de contraseña, restauración y reintento
- [x] 4.2 Actualizar documentación canónica, operación, trazabilidad y plan de despliegue/reversión
- [x] 4.3 Ejecutar verificación proporcional y registrar resultados/bloqueos de baseline
- [x] 4.4 Ejecutar revisión adversarial de permisos, tokens, estados parciales y regresiones
