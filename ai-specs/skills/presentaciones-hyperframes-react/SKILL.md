---
name: presentaciones-hyperframes-react
description: Crea o modifica presentaciones runtime de Pulse Hub mediante deck.json, aplicando doctrina HyperFrames y el reproductor React + Tailwind + Framer Motion. Usar al generar, corregir o revisar una presentacion de la Skill sistema:presentaciones.
---

# Presentaciones HyperFrames + React

## Flujo

1. Confirmar tema, audiencia, objetivo y fuentes.
2. Redactar `guion.md` con una tesis, evidencia y visual por diapositiva.
3. Elegir un movimiento maestro para toda la baraja y una continuidad por escena.
4. Guardar imagenes bajo `assets/` con nombres estables y texto alternativo.
5. Escribir `deck.json` version 1. No escribir HTML, CSS, JS, JSX ni clases Tailwind.
6. Volver a leer el JSON y corregir cualquier error de esquema antes de cerrar.

## Fusion tecnologica

- HyperFrames decide continuidad, ritmo, capas, entradas y enfasis semantico.
- React conserva un lienzo fijo 1920x1080 y selecciona composiciones probadas.
- Tailwind aplica jerarquia, espacio, contraste y tokens de marca.
- Framer Motion traduce el vocabulario de movimiento y respeta `prefers-reduced-motion`.
- El servidor loopback solo publica `deck.json`, `estilos/marca.css` y `assets/` de una sesion opaca.

## Reglas duras

- Una diapositiva, una idea; dividir antes de reducir tipografia.
- Alternar arquetipos y densidad. Evitar tableros de tarjetas repetidas.
- Usar solo `portada`, `declaracion`, `division`, `comparacion`, `proceso`, `metricas`, `cita` y `cierre`.
- Usar solo continuidad `corte`, `empuje`, `zoom` o `flujo`; entrada `ascenso`, `revelado`, `foco` o `trazo`; enfasis `ninguno`, `pulso`, `conteo` o `recorrido`.
- No inventar datos, testimonios, fuentes ni imagenes inexistentes.
- No declarar verificacion visual sin evidencia observada.

Consultar `src/shared/presentations/deck-schema.ts` cuando haga falta el contrato exacto.
