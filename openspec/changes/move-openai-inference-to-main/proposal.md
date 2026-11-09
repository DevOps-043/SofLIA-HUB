## Why

El renderer construye OpenAI con dangerouslyAllowBrowser y una clave leída de
Lia o VITE_OPENAI_API_KEY. Un contenido comprometido puede recuperar esa credencial,
y el cliente compartido hereda una caché que mezcla proveedores/usuarios.

## What Changes

- Ejecutar Responses normal y streaming con SDK en main; renderer recibe datos y nunca la clave OpenAI.
- Ligar el cliente y los trabajos a fuente/documento/identidad y sesión Lia; revocar A/B/A y navegación.
- Añadir API cerrada open/start/pull/cancel con límites y presión de lectura, sin URL, headers o métodos remotos configurables.
- Mantener selección de modelos, herramientas/HITL, citas, uso y reintentos del pipeline actual.
- Retirar la clave OpenAI del entorno público Vite y de defines preload; conservar fallback nativo existente.

## Capabilities

### New Capabilities
- `native-openai-inference`: Responses nativa con credenciales no entregadas al renderer y ciclo de vida acotado.

### Modified Capabilities
Ninguna especificación canónica modificada.

## Impact

Servicio/handler main, preload/allowlist, DTO/wrapper renderer, cliente de chat y
workers de análisis, configuración Vite y pruebas/documentación. Sin dependencias,
tablas o SQL nuevos. Google/medios/OAuth y secretos incorporados al bundle main
conservan trabajo pendiente: esta unidad no declara cerrada toda la custodia IA.
