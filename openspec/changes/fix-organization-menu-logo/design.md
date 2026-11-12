## Decisiones
- Usar `logo_url` antes de `brand_favicon_url` tanto para la organización activa como para las filas del selector. Ambos campos ya pertenecen al contrato y a la consulta de perfil.
- Compartir un componente de imagen que descarta candidatos vacíos y duplicados y avanza ante errores de carga. Cambiar de organización o actualizar URLs restablece los candidatos.
- Mantener proporción con `object-contain`, espacio de 40 px de alto y hasta 144 px de ancho en el acceso expandido; el acceso compacto y las filas usan 32 px cuadrados. Sin máscaras ni superficies alrededor del logo.
- El acceso de organización conserva nombre mediante `aria-label` y `title`; el nombre visible permanece en el selector. Sin organización disponible se conserva la identidad personal existente.

## Límites y reversión
No se inspeccionan datos remotos ni se garantiza que todas las URLs existentes sean públicas y válidas. No se puede eliminar un fondo o margen que forme parte del propio archivo. Revertir los archivos del cambio restaura el aspecto anterior sin migración.
