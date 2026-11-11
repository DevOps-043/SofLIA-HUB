# Verificación de conversación Gemini nativa

Fecha 2026-11-07. Verificación local aprobada.

El chat general, los especialistas y la fase de acciones usan el mismo puente
nativo. Títulos, redacción y optimización usan el servicio con un turno de texto.
Los clientes del navegador independiente se construyen por operación. Se retiró
la caché por clave y el export resetClient, que carecía de consumidores.

Se ejecutaron 106 pruebas dirigidas. Una prueba recorre preload y allowlist,
handler y SDK real con transporte ficticio. El segundo mensaje verifica el rol
user de la respuesta de herramienta, la firma del modelo y el contexto previo.
Las pruebas de consumidores verifican las seis rutas y sus parámetros. Las
pruebas de modo web siguen usando los SDK ficticios anteriores.

## Revisión propia

El contrato cerrado rechaza claves, configuración de transporte, enumeraciones
con tipo incorrecto y referencias file. Main acepta datos declarativos y deriva
la configuración combinada de herramientas. La proyección de respuesta incluye
texto, candidatos y feedback dentro del presupuesto JSON. El dispatcher y sus
permisos conservan su contrato de dominio.

Se verificó propietario de turno, A/B/A mientras espera credencial, cancelación
al abrir, cuatro plazas físicas tras cierre, timeout sin commit tardío y
caducidad de turnos inactivos. El renderer vincula la preparación del turno a
sesión y propaga la señal al dispatcher. Las herramientas ya iniciadas se rigen
por sus propios contratos de cancelación y efectos.

## Decisiones y límites

Main adopta 40 s por llamada, cuatro turnos y cuatro llamadas físicas, 64 intentos
y 20 min de inactividad. La apertura admite 2 MiB, el mensaje e historial 96 MiB
cada uno y la respuesta 16 MiB. Un historial fuera de presupuesto falla sin
incorporar el resultado. Los errores usan códigos fijos y el log correlacionado
registra duración y éxito. El navegador independiente mantiene sus credenciales
explícitas y los SDK que consumía.

La configuración VITE y su paso por ajustes siguen pendientes. Las pruebas
sustituyen red, cuentas y efectos de herramientas. La revisión independiente,
la acreditación con proveedor real y la integración de ramas siguen abiertas.

Logs, JSON, huella y respaldos en `%TEMP%/soflia-native-gemini-chat-2026-11-07/`.

## Destino del SDK

La primera compuerta se interrumpió al detectar que el SDK Node podía adoptar
la URL de su entorno. La regresión con transporte ficticio reprodujo el envío
al host alternativo. Main fija el origen Gemini Developer API y v1beta, con
Vertex desactivado. La prueba ejerce ambas variables ficticias y comprueba la
URL real de la petición junto con el segundo salto de herramientas.

## Integración con equipos supervisados

La compuerta tras fijar el destino terminó en código 1. Pasaron 7070 pruebas,
se omitieron 5 y fallaron 5 aserciones de background-teams que esperaban el
error del cliente renderer. Se actualizó ese fixture para recibir una respuesta
supervisada del puente nativo. Las aserciones conservan la prohibición de iniciar
un equipo en segundo plano antes de recoger evidencia y verifican el envío
nativo. Pasaron sus 33 pruebas dirigidas. La huella de producción coincide con
la compilación aislada aprobada tras fijar el destino. Se repite la compuerta
completa en gate-reviewed.log.

## Resultado local

`npm run verify:pr` terminó con código 0 en `gate-reviewed.exit`. Pasaron 7075
pruebas y se omitieron 5. El lint incremental revisó 746 archivos sin deuda nueva.
V8 verificó 2637 fuentes productivas. Cobertura de líneas 60.69%, sentencias
59.15%, funciones 55.61% y ramas 52.52%. `npm run app:smoke:build` terminó con
código 0 en `build-final.exit`. Persisten los avisos de tamaño de fragmentos.

La huella productiva coincide con la compilada y con la previa a la compuerta.
SHA-256 `446b93b1043014ce305c8a9d47ca99837e23e16fc8f710418694d45cafdfe175`.
La revisión independiente sigue abierta en la tarea 1.4.
