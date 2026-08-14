---
name: presentaciones-hyperframes-react
description: Crea o modifica presentaciones runtime de Pulse Hub mediante deck.json, aplicando doctrina HyperFrames y el reproductor React + Tailwind + Framer Motion. Usar al generar, corregir o revisar una presentacion de la Skill sistema:presentaciones.
---

# Presentaciones HyperFrames + React

## Flujo

1. Confirmar tema, audiencia, objetivo y fuentes.
2. Redactar `guion.md` con una tesis, evidencia y visual por diapositiva.
3. Elegir un movimiento maestro para toda la baraja y una continuidad por escena.
4. Auditar primero el manifiesto de visuales de fuente: reutilizar las fotografias, capturas, diagramas y graficas ya importadas desde el documento o pagina. Guardarlas bajo `assets/` con nombres estables y texto alternativo; generar imagenes nuevas solo como complemento. En barajas de 8 o mas diapositivas, usar imagen significativa en 40%-60%, al menos 3 recursos distintos y no repetir uno mas de dos veces.
5. Escribir `deck.json` version 1. No escribir HTML, CSS, JS, JSX ni clases Tailwind.
6. Consultar `src/shared/presentations/deck-schema.ts` y usar solo los campos exactos de cada arquetipo.
7. Volver a leer el JSON y corregir cualquier error de esquema antes de cerrar.

## Fusion tecnologica

- HyperFrames decide continuidad, ritmo, capas, entradas y enfasis semantico.
- React conserva un lienzo fijo 1920x1080 y selecciona composiciones probadas.
- Tailwind aplica jerarquia, espacio, contraste y tokens de marca.
- Framer Motion traduce el vocabulario de movimiento, las microinteracciones de cursor y respeta `prefers-reduced-motion`.
- Recharts convierte evidencia cuantitativa declarativa en barras, lineas, areas, radares o anillos interactivos.
- El servidor loopback solo publica `deck.json`, `estilos/marca.css` y `assets/` de una sesion opaca.

## Reglas duras

- Una diapositiva, una idea; dividir antes de reducir tipografia.
- Alternar arquetipos y densidad. Evitar tableros de tarjetas repetidas.
- Usar solo `portada`, `declaracion`, `division`, `comparacion`, `proceso`, `metricas`, `grafica`, `cita` y `cierre`.
- Preferir `grafica` sobre tablas, filas o tarjetas cuando existen valores cuantitativos comparables. No dejar mas de dos diapositivas seguidas sin imagen o grafica.
- Usar solo continuidad `corte`, `empuje`, `zoom` o `flujo`; entrada `ascenso`, `revelado`, `foco` o `trazo`; enfasis `ninguno`, `pulso`, `conteo` o `recorrido`.
- No inventar datos, testimonios, fuentes ni imagenes inexistentes.
- No recrear con IA una imagen o grafica documental disponible en la fuente. Los visuales generados complementan; los de fuente sostienen la evidencia.
- No declarar verificacion visual sin evidencia observada.

Consultar `src/shared/presentations/deck-schema.ts` cuando haga falta el contrato exacto.
