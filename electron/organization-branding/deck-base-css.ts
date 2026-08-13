/**
 * Capa de diseno que main escribe en el workspace junto a la hoja de marca.
 *
 * Por que esto y no Tailwind o React dentro de la presentacion: el entregable
 * es un HTML que debe abrirse sin conexion y viajar como archivo unico.
 * Tailwind necesita un paso de compilacion y React un bundle; traerlos por CDN
 * choca con la regla de recursos remotos y con la CSP del visor. Una capa
 * curada da lo mismo que se busca —escala tipografica coherente, primitivas de
 * composicion y utilidades de animacion— sin build, sin red y en pocos KB.
 *
 * El modelo compone con estas clases en vez de reinventar el sistema en cada
 * presentacion, que es lo que hacia que unas salieran bien y otras no.
 */
export const DECK_BASE_CSS = `/* Sistema de diseno de presentaciones de Pulse Hub.
   NO EDITAR: se reescribe en cada generacion. Compon con estas clases y
   escribe en estilos/presentacion.css solo lo especifico de esta baraja. */

*, *::before, *::after { box-sizing: border-box; }

:root {
  /* Escala tipografica fluida: se lee igual en un portatil y en un proyector. */
  --paso--2: clamp(0.72rem, 0.55vw + 0.6rem, 0.85rem);
  --paso--1: clamp(0.85rem, 0.7vw + 0.7rem, 1.05rem);
  --paso-0:  clamp(1rem, 0.9vw + 0.8rem, 1.3rem);
  --paso-1:  clamp(1.3rem, 1.6vw + 0.9rem, 1.9rem);
  --paso-2:  clamp(1.7rem, 2.6vw + 1rem, 2.8rem);
  --paso-3:  clamp(2.2rem, 4.2vw + 1rem, 4.2rem);
  --paso-4:  clamp(2.8rem, 6.5vw + 1rem, 6.5rem);

  --ritmo: clamp(0.75rem, 1.1vw, 1.25rem);
  --margen: clamp(2.5rem, 6vw, 6rem);
  --radio: 18px;

  --sombra-suave: 0 2px 8px rgb(0 0 0 / 0.06), 0 12px 32px rgb(0 0 0 / 0.08);
  --sombra-elevada: 0 4px 12px rgb(0 0 0 / 0.10), 0 24px 56px rgb(0 0 0 / 0.16);
  --curva: cubic-bezier(0.22, 0.61, 0.36, 1);

  /* Pareja de contraste para cualquier superficie oscura (imagen con velo,
     tarjeta de color pleno). Son fijas a proposito: derivarlas de la marca es
     lo que producia texto negro sobre un fondo oscuro. */
  --sobre-oscuro: #ffffff;
  --sobre-oscuro-tenue: rgb(255 255 255 / 0.80);
  /* Y su equivalente para superficies claras. */
  --sobre-claro: #0b1220;
  --sobre-claro-tenue: rgb(11 18 32 / 0.72);
}

html { scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: var(--marca-tipografia);
  font-size: var(--paso-0);
  line-height: 1.5;
  color: var(--marca-color-texto);
  background: var(--marca-color-fondo);
  /* Cifras de ancho fijo: una tabla o un contador no bailan al animarse. */
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

/* --- Baraja: navegacion por scroll, sin botones ------------------------- */
.baraja {
  scroll-snap-type: y mandatory;
  overflow-y: auto;
  height: 100vh;
  scrollbar-width: none;
}
.baraja::-webkit-scrollbar { display: none; }

/* Variante horizontal: la baraja avanza de izquierda a derecha. El sentido lo
   elige la presentacion; el resto del sistema funciona igual en ambos. */
.baraja--horizontal {
  scroll-snap-type: x mandatory;
  overflow-x: auto;
  overflow-y: hidden;
  display: flex;
  height: 100vh;
}
.baraja--horizontal > .diapositiva {
  flex: 0 0 100vw;
  /* Respaldo si el guion no se ejecuta: lo que no quepa se puede desplazar en
     vertical dentro de la propia diapositiva, en vez de quedar cortado. */
  overflow-y: auto;
  scrollbar-width: none;
}
.baraja--horizontal > .diapositiva::-webkit-scrollbar { display: none; }

/* Rejilla de filas en flujo, centradas como bloque.
   Antes el pie iba en posicion absoluta y el contenido se centraba encima:
   en cuanto una diapositiva traia algo mas de texto, el pie quedaba ENCIMA de
   ese texto. En flujo eso es imposible. Y sin overflow hidden, lo que no
   cabe hace crecer la diapositiva en vez de recortarse sin avisar. */
.diapositiva {
  scroll-snap-align: start;
  scroll-snap-stop: always;
  position: relative;
  display: grid;
  grid-auto-rows: min-content;
  /* La palabra clave safe es la diferencia entre una diapositiva bien puesta y una con el
     contenido empujado hacia abajo: centra cuando cabe, y cuando NO cabe se
     alinea arriba en vez de desbordar por los dos lados a la vez. */
  align-content: safe center;
  min-height: 100vh;
  padding: var(--margen);
  row-gap: calc(var(--ritmo) * 1.5);
}

/* Con el guion instalado, la diapositiva representa un lienzo y no puede
   crecer mas que la ventana. El ajuste reduce el contenido; el scroll interno
   es la red de seguridad cuando ni al 50 % cabe. */
.deck-js .diapositiva {
  height: 100vh;
  max-height: 100vh;
  overflow-y: auto;
  scrollbar-width: none;
}
.deck-js .diapositiva::-webkit-scrollbar { display: none; }

/* Marco de altura explicita + contenido absoluto: el transform reduce los
   pixeles y el marco reduce a la vez el espacio de maquetacion. */
.diapositiva__marco {
  position: absolute;
  inset-inline: 0;
  width: 100%;
  justify-self: stretch;
}
.diapositiva__ajuste {
  display: grid;
  grid-auto-rows: min-content;
  row-gap: calc(var(--ritmo) * 1.5);
  position: absolute;
  inset: 0 auto auto 0;
  z-index: 1;
  width: 100%;
  transform-origin: top center;
}

/* --- Tipografia --------------------------------------------------------- */
.antetitulo {
  font-size: var(--paso--1);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--marca-color-primario);
  margin: 0 0 calc(var(--ritmo) * 1.5);
}
.titular {
  /* Los titulares grandes necesitan tracking negativo: con el normal se ven
     desparramados. */
  font-size: var(--paso-3);
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.03em;
  margin: 0;
  text-wrap: balance;
}
.titular--grande { font-size: var(--paso-4); }
.subtitulo {
  font-size: var(--paso-1);
  font-weight: 400;
  line-height: 1.35;
  color: var(--marca-color-texto-tenue);
  margin: var(--ritmo) 0 0;
  max-width: 46ch;
  text-wrap: pretty;
}
.cuerpo { max-width: 62ch; margin: var(--ritmo) 0 0; }
.pie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ritmo);
  margin-top: calc(var(--ritmo) * 2);
  padding-top: var(--ritmo);
  border-top: 1px solid color-mix(in srgb, var(--marca-color-texto) 10%, transparent);
  font-size: var(--paso--2);
  color: var(--marca-color-texto-tenue);
}

/* --- Composicion -------------------------------------------------------- */
.columnas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  gap: calc(var(--ritmo) * 2);
  align-items: start;
}
.rejilla-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
  gap: var(--ritmo);
}
.tarjeta {
  position: relative;
  padding: calc(var(--ritmo) * 1.5);
  border-radius: var(--radio);
  background: color-mix(in srgb, var(--marca-color-primario) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--marca-color-primario) 14%, transparent);
  box-shadow: var(--sombra-suave);
  transition: transform 0.28s var(--curva), box-shadow 0.28s var(--curva), border-color 0.28s var(--curva);
}
/* Al pasar el cursor la tarjeta se eleva. Es el gesto que hace que la baraja
   se sienta viva sin que nada se mueva solo mientras alguien esta hablando. */
.tarjeta:hover {
  transform: translateY(-4px);
  box-shadow: var(--sombra-elevada);
  border-color: color-mix(in srgb, var(--marca-color-primario) 42%, transparent);
}
/* Variantes de superficie: la de acento invierte el texto a la pareja clara. */
.tarjeta--acento {
  background: linear-gradient(140deg,
    color-mix(in srgb, var(--marca-color-primario) 22%, transparent),
    color-mix(in srgb, var(--marca-color-acento) 10%, transparent));
  border-color: color-mix(in srgb, var(--marca-color-primario) 34%, transparent);
}
.tarjeta--pleno {
  background: var(--marca-color-primario);
  border-color: transparent;
  color: var(--sobre-oscuro);
}
.tarjeta--pleno .cuerpo,
.tarjeta--pleno .subtitulo { color: var(--sobre-oscuro-tenue); }
/* Filo superior de color: distingue tarjetas de una serie sin repetir forma. */
.tarjeta--filo { border-top: 3px solid var(--marca-color-primario); }
.tarjeta--filo:nth-child(2n) { border-top-color: var(--marca-color-secundario); }
.tarjeta--filo:nth-child(3n) { border-top-color: var(--marca-color-acento); }
.lista { list-style: none; padding: 0; margin: var(--ritmo) 0 0; display: grid; gap: calc(var(--ritmo) * 0.75); }
.lista li { display: flex; gap: 0.75rem; align-items: flex-start; }
.lista svg { flex: 0 0 auto; width: 1.25em; height: 1.25em; color: var(--marca-color-primario); }

/* --- Cifras ------------------------------------------------------------- */
.cifra { display: flex; flex-direction: column; gap: 0.25rem; }
.cifra__valor {
  font-size: var(--paso-3);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--marca-color-primario);
}
.cifra__etiqueta { font-size: var(--paso--1); color: var(--marca-color-texto-tenue); }

/* --- Tablas ------------------------------------------------------------- */
.tabla { width: 100%; border-collapse: collapse; margin-top: var(--ritmo); }
.tabla th, .tabla td { padding: 0.7em 0.9em; text-align: left; }
.tabla thead th {
  font-size: var(--paso--1);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--marca-color-texto-tenue);
  border-bottom: 2px solid color-mix(in srgb, var(--marca-color-primario) 40%, transparent);
}
.tabla tbody tr + tr td { border-top: 1px solid color-mix(in srgb, var(--marca-color-texto) 10%, transparent); }
.tabla .num { text-align: right; }

/* --- Imagenes ------------------------------------------------------------ */
/* Fondo a sangre con velo de marca: sin el velo, el texto sobre una fotografia
   deja de ser legible en cuanto la imagen tiene zonas claras. */
.imagen-fondo {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}
.imagen-fondo img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* El velo SIEMPRE oscurece. Antes se tenia del color primario a secas: con una
   marca de color claro el velo salia claro, y el texto —que usaba el color de
   fondo de la marca, oscuro en un tema oscuro— quedaba negro sobre verde
   claro, ilegible. Mezclar contra negro garantiza el contraste sea cual sea
   la marca, y conserva su tinte. */
.imagen-fondo::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--marca-color-primario) 30%, rgb(0 0 0 / 0.92)),
    color-mix(in srgb, var(--marca-color-primario) 30%, rgb(0 0 0 / 0.62))
  );
}
/* El contenido de una diapositiva con fondo se apila por encima del velo. */
.diapositiva > :not(.imagen-fondo) { position: relative; z-index: 1; }

/* Texto sobre imagen: color fijo y legible, nunca derivado de la marca. */
.diapositiva--imagen { color: var(--sobre-oscuro); }
.diapositiva--imagen .titular,
.diapositiva--imagen .cifra__valor { color: var(--sobre-oscuro); }
.diapositiva--imagen .antetitulo { color: var(--sobre-oscuro-tenue); }
.diapositiva--imagen .subtitulo,
.diapositiva--imagen .cuerpo,
.diapositiva--imagen .cifra__etiqueta,
.diapositiva--imagen .pie { color: var(--sobre-oscuro-tenue); }
.diapositiva--imagen .pie { border-top-color: rgb(255 255 255 / 0.18); }
.diapositiva--imagen .tarjeta {
  background: rgb(0 0 0 / 0.42);
  border-color: rgb(255 255 255 / 0.16);
  backdrop-filter: blur(6px);
}
/* Un componente local puede conservar deliberadamente una superficie clara
   sobre la imagen. El guion la detecta por luminancia y restaura texto oscuro. */
.diapositiva--imagen .superficie--clara-auto,
.diapositiva--imagen .superficie--clara-auto .cuerpo,
.diapositiva--imagen .superficie--clara-auto .subtitulo { color: var(--sobre-claro); }

.figura { margin: 0; }
.figura img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--radio);
  box-shadow: 0 18px 48px color-mix(in srgb, var(--marca-color-texto) 22%, transparent);
}
.figura figcaption {
  margin-top: calc(var(--ritmo) * 0.6);
  font-size: var(--paso--1);
  color: var(--marca-color-texto-tenue);
}

/* --- Graficas ----------------------------------------------------------- */
/* Dona de una sola cifra: sin SVG, sin libreria. Define --valor de 0 a 100. */
.anillo {
  --valor: 0;
  position: relative;
  display: grid;
  place-items: center;
  width: clamp(8rem, 14vw, 12rem);
  aspect-ratio: 1;
  border-radius: 50%;
  background: conic-gradient(
    var(--marca-color-primario) calc(var(--valor) * 1%),
    color-mix(in srgb, var(--marca-color-texto) 12%, transparent) 0
  );
}
.anillo::before {
  content: '';
  position: absolute;
  inset: 14%;
  border-radius: 50%;
  background: var(--marca-color-fondo);
}
.anillo > * { position: relative; }

/* Barra de progreso horizontal. Define --valor de 0 a 100. */
.medidor {
  --valor: 0;
  height: 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--marca-color-texto) 12%, transparent);
  overflow: hidden;
}
.medidor::after {
  content: '';
  display: block;
  height: 100%;
  width: calc(var(--valor) * 1%);
  border-radius: inherit;
  background: linear-gradient(90deg, var(--marca-color-primario), var(--marca-color-acento));
  transform-origin: left;
}
@keyframes llenar { from { transform: scaleX(0); } to { transform: scaleX(1); } }

/* --- Diagramas ----------------------------------------------------------- */
/* Contenedor de cualquier SVG dibujado a mano. Sin esto, un SVG con viewBox
   propio se sale de la diapositiva o se corta por abajo: es el fallo que hacia
   que los diagramas se vieran mal. Aqui SIEMPRE cabe. */
.diagrama {
  display: grid;
  place-items: center;
  width: 100%;
  max-height: 46vh;
  margin-block: var(--ritmo);
}
.diagrama > svg {
  width: 100%;
  height: auto;
  max-height: 46vh;
  overflow: visible;
}
.diagrama text { fill: var(--marca-color-texto); font-family: var(--marca-tipografia); }
.diagrama .etiqueta-svg { fill: var(--marca-color-texto-tenue); font-size: 14px; font-weight: 600; }

/* Cadena de pasos con conectores. Sustituye al SVG hecho a mano para un flujo:
   se reparte solo, no se descuadra y los conectores no se salen. */
.flujo {
  display: flex;
  align-items: stretch;
  gap: 0;
  flex-wrap: wrap;
}
.flujo__paso {
  flex: 1 1 12rem;
  position: relative;
  padding: calc(var(--ritmo) * 1.4);
  border-radius: var(--radio);
  background: color-mix(in srgb, var(--marca-color-primario) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--marca-color-primario) 18%, transparent);
  transition: transform 0.28s var(--curva), border-color 0.28s var(--curva);
}
.flujo__paso:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--marca-color-primario) 45%, transparent);
}
/* Conector entre pasos: una linea con punta, dibujada con bordes. */
.flujo__paso + .flujo__paso { margin-left: calc(var(--ritmo) * 2.5); }
.flujo__paso + .flujo__paso::before {
  content: '';
  position: absolute;
  left: calc(var(--ritmo) * -2.1);
  top: 50%;
  width: calc(var(--ritmo) * 1.7);
  height: 2px;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--marca-color-primario) 30%, transparent),
    var(--marca-color-primario));
}
.flujo__paso + .flujo__paso::after {
  content: '';
  position: absolute;
  left: calc(var(--ritmo) * -0.6);
  top: 50%;
  width: 7px;
  height: 7px;
  border-top: 2px solid var(--marca-color-primario);
  border-right: 2px solid var(--marca-color-primario);
  transform: translateY(-50%) rotate(45deg);
}
.flujo__numero {
  display: block;
  font-size: var(--paso--1);
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--marca-color-primario);
  margin-bottom: 0.4rem;
}
.flujo--vertical { flex-direction: column; }
.flujo--vertical .flujo__paso + .flujo__paso { margin-left: 0; margin-top: calc(var(--ritmo) * 2.5); }
.flujo--vertical .flujo__paso + .flujo__paso::before {
  left: 50%;
  top: calc(var(--ritmo) * -2.1);
  width: 2px;
  height: calc(var(--ritmo) * 1.7);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--marca-color-primario) 30%, transparent),
    var(--marca-color-primario));
}
.flujo--vertical .flujo__paso + .flujo__paso::after {
  left: 50%;
  top: calc(var(--ritmo) * -0.6);
  transform: translateX(-50%) rotate(135deg);
}

/* Nucleo con satelites repartidos en circulo. Cada satelite declara su angulo
   con --angulo; el radio es comun. Resuelve el diagrama radial que sale
   torcido cuando se colocan a ojo con coordenadas absolutas. */
.orbita {
  --radio-orbita: clamp(7rem, 15vw, 12rem);
  position: relative;
  display: grid;
  place-items: center;
  width: calc(var(--radio-orbita) * 2 + 12rem);
  max-width: 100%;
  aspect-ratio: 1;
  margin-inline: auto;
}
/* El anillo se dibuja EXACTAMENTE sobre el radio de los satelites. Con un
   inset fijo quedaba descuadrado respecto a ellos, que es lo que hacia que el
   diagrama se viera mal hecho. */
.orbita::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(var(--radio-orbita) * 2);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px dashed color-mix(in srgb, var(--marca-color-primario) 28%, transparent);
}
.orbita__nucleo {
  display: grid;
  place-items: center;
  text-align: center;
  /* Relleno proporcional y texto acotado: con un tamano fijo, un rotulo de dos
     palabras se salia del circulo. */
  padding: 14%;
  border-radius: 50%;
  aspect-ratio: 1;
  width: clamp(7rem, 13vw, 9.5rem);
  background: color-mix(in srgb, var(--marca-color-primario) 16%, var(--marca-color-fondo));
  border: 2px solid var(--marca-color-primario);
  font-weight: 700;
  font-size: var(--paso--1);
  line-height: 1.15;
  text-wrap: balance;
  overflow-wrap: anywhere;
}
.orbita__satelite {
  position: absolute;
  top: 50%;
  left: 50%;
  width: max-content;
  max-width: 11rem;
  padding: 0.6rem 0.95rem;
  border-radius: 999px;
  text-align: center;
  font-size: var(--paso--1);
  background: var(--marca-color-fondo);
  border: 1px solid color-mix(in srgb, var(--marca-color-primario) 34%, transparent);
  transform:
    translate(-50%, -50%)
    rotate(calc(var(--angulo, 0) * 1deg))
    translateY(calc(var(--radio-orbita) * -1))
    rotate(calc(var(--angulo, 0) * -1deg));
  transition: border-color 0.28s var(--curva), transform 0.28s var(--curva);
}

/* --- Capa de plano tecnico ----------------------------------------------- */
/* Retícula tenue y marcas de registro en las esquinas. Es la firma visual que
   hace que una baraja parezca un documento tecnico coherente en vez de una
   sucesion de diapositivas sueltas. Va en la diapositiva, detras de todo. */
.plano {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(color-mix(in srgb, var(--marca-color-texto) 5%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--marca-color-texto) 5%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, #000 35%, transparent 78%);
}
/* Marcas de registro: dos esquinas en angulo, como en un plano. */
.plano::before,
.plano::after {
  content: '';
  position: absolute;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid color-mix(in srgb, var(--marca-color-primario) 34%, transparent);
}
.plano::before { top: 1.25rem; left: 1.25rem; border-right: 0; border-bottom: 0; }
.plano::after { bottom: 1.25rem; right: 1.25rem; border-left: 0; border-top: 0; }

/* Cota: una linea de medida con sus topes, como en un dibujo tecnico. */
.cota {
  position: relative;
  height: 1px;
  background: color-mix(in srgb, var(--marca-color-texto) 30%, transparent);
  margin-block: calc(var(--ritmo) * 1.2);
}
.cota::before,
.cota::after {
  content: '';
  position: absolute;
  top: -4px;
  width: 1px;
  height: 9px;
  background: color-mix(in srgb, var(--marca-color-texto) 42%, transparent);
}
.cota::before { left: 0; }
.cota::after { right: 0; }
.cota__valor {
  position: absolute;
  left: 50%;
  top: -1.4em;
  transform: translateX(-50%);
  padding-inline: 0.5rem;
  background: var(--marca-color-fondo);
  font-size: var(--paso--2);
  letter-spacing: 0.08em;
  color: var(--marca-color-texto-tenue);
}

/* --- Composiciones de diapositiva ---------------------------------------- */
/* Rail: franja de titulo a la izquierda y bloques de contenido a la derecha.
   Es la composicion que permite densidad ALTA sin que se vea amontonada. */
.rail {
  display: grid;
  grid-template-columns: minmax(14rem, 22rem) 1fr;
  gap: clamp(1.5rem, 4vw, 4rem);
  align-items: start;
}
.rail__titulo {
  position: relative;
  padding-left: calc(var(--ritmo) * 1.2);
  border-left: 3px solid var(--marca-color-primario);
}
.rail__bloques { display: grid; gap: calc(var(--ritmo) * 1.6); }
/* Bloque: numero o icono, titulo, texto y su propio apoyo visual al lado. */
.bloque {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: calc(var(--ritmo) * 1.2);
  align-items: start;
  padding-bottom: calc(var(--ritmo) * 1.4);
  border-bottom: 1px solid color-mix(in srgb, var(--marca-color-texto) 9%, transparent);
}
.rail__bloques > .bloque:last-child { border-bottom: 0; padding-bottom: 0; }
.bloque__marca {
  display: grid;
  place-items: center;
  width: 2.6rem;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--marca-color-primario) 40%, transparent);
  color: var(--marca-color-primario);
  font-size: var(--paso--1);
  font-weight: 700;
}
.bloque__titulo { margin: 0 0 0.35rem; font-size: var(--paso-1); font-weight: 700; line-height: 1.15; }
.bloque__texto { margin: 0; font-size: var(--paso--1); color: var(--marca-color-texto-tenue); max-width: 52ch; }
/* Con apoyo visual el bloque pasa a tres columnas. */
.bloque--con-apoyo { grid-template-columns: auto minmax(0, 1fr) minmax(0, 0.9fr); }

/* Comparativa: dos paneles enfrentados con separador central.
   Los lados llevan suelo y el eje se queda en su ancho minimo: con auto en
   el centro, cualquier cosa ancha ahi robaba el espacio y los paneles se
   estrechaban hasta partir el texto en una palabra por linea. */
.comparativa {
  display: grid;
  grid-template-columns: minmax(15rem, 1fr) min-content minmax(15rem, 1fr);
  gap: clamp(1rem, 3vw, 2.5rem);
  align-items: stretch;
}
.comparativa > * { min-width: 0; }
@media (max-width: 60rem) {
  .comparativa { grid-template-columns: 1fr; }
  .comparativa__eje { display: none; }
}
.comparativa__eje {
  width: 1px;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--marca-color-texto) 22%, transparent), transparent);
}

/* Capas: pila en perspectiva, para arquitecturas por niveles. */
.capas { display: grid; gap: calc(var(--ritmo) * 0.9); perspective: 1200px; }
.capa {
  padding: calc(var(--ritmo) * 1.1) calc(var(--ritmo) * 1.5);
  border-radius: calc(var(--radio) * 0.7);
  border: 1px solid color-mix(in srgb, var(--marca-color-primario) 24%, transparent);
  background: color-mix(in srgb, var(--marca-color-primario) 6%, transparent);
  transform: rotateX(14deg) translateZ(0);
  transform-origin: center bottom;
  transition: transform 0.35s var(--curva), border-color 0.35s var(--curva);
}
.capa:hover {
  transform: rotateX(0deg) translateY(-3px);
  border-color: color-mix(in srgb, var(--marca-color-primario) 55%, transparent);
}

/* --- Ambiente ------------------------------------------------------------ */
/* Halo de color muy lento detras del contenido. Es decorativo y va SIEMPRE en
   el fondo, nunca sobre el texto: da vida a la diapositiva sin competir con
   quien esta presentando. */
.halo {
  position: absolute;
  z-index: 0;
  width: clamp(22rem, 46vw, 46rem);
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.28;
  background: radial-gradient(circle at 50% 50%, var(--marca-color-primario), transparent 68%);
  animation: respirar 14s ease-in-out infinite alternate;
  pointer-events: none;
}
.halo--acento { background: radial-gradient(circle at 50% 50%, var(--marca-color-acento), transparent 68%); }
@keyframes respirar {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(2%, -3%, 0) scale(1.12); }
}

/* --- Movimiento --------------------------------------------------------- */
@keyframes surgir { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes surgir-izquierda { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: none; } }
@keyframes surgir-derecha { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: none; } }
@keyframes surgir-escala { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }
@keyframes crecer { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes trazar { from { stroke-dashoffset: var(--largo, 1000); } to { stroke-dashoffset: 0; } }
@keyframes acercar { from { transform: scale(1.12); } to { transform: scale(1); } }
@keyframes barrer { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes surgir-difuso { from { opacity: 0; filter: blur(10px); transform: translateY(10px); } to { opacity: 1; filter: none; transform: none; } }
@keyframes surgir-abajo { from { opacity: 0; transform: translateY(-22px); } to { opacity: 1; transform: none; } }

/* Entrada del contenido.

   Estaba ligada al scroll (animation-timeline: view()). Con scroll-snap el
   salto de una diapositiva a la siguiente RECORRE ENTERO el rango de entrada
   en lo que dura el salto: la animacion ocurria, pero era imperceptible, y los
   retardos escalonados ni siquiera se aplicaban —sobre una linea de tiempo de
   scroll animation-delay se ignora—. Ahora la dispara guion-base.js cuando la
   diapositiva entra en pantalla, y son animaciones por TIEMPO: se ven, duran y
   se escalonan de verdad.

   El estado inicial oculto solo existe con la clase deck-js, que pone ese
   guion. Si no se ejecuta, todo queda visible y estatico. */
.deck-js .aparece,
.deck-js .palabras > *,
.deck-js .barra,
.deck-js .traza,
.deck-js .medidor::after { opacity: 0; }

.deck-js .diapositiva.activa .aparece {
  animation: surgir 0.65s var(--curva) both;
  opacity: 1;
}
.aparece--izquierda { animation-name: surgir-izquierda; }
.aparece--derecha { animation-name: surgir-derecha; }
.aparece--escala { animation-name: surgir-escala; }
.aparece--difuso { animation-name: surgir-difuso; }
.aparece--abajo { animation-name: surgir-abajo; }
/* Barrido lateral para titulares y subrayados: revela el texto, no lo desplaza. */
.aparece--barrido { animation-name: barrer; animation-duration: 0.85s; }

/* Escalonado real: con animaciones por tiempo el retardo SI se aplica. */
.retardo-1 { animation-delay: 0.10s; }
.retardo-2 { animation-delay: 0.20s; }
.retardo-3 { animation-delay: 0.30s; }
.retardo-4 { animation-delay: 0.42s; }
.retardo-5 { animation-delay: 0.54s; }
.retardo-6 { animation-delay: 0.66s; }

/* Revelado palabra a palabra. guion-base.js numera los span con --i, asi que
   basta con envolver el titular en .palabras */
.palabras > * { display: inline-block; }
.deck-js .diapositiva.activa .palabras > * {
  animation: surgir 0.6s var(--curva) both;
  animation-delay: calc(var(--i, 0) * 0.075s);
  opacity: 1;
}

/* Series de elementos que se escalonan solas, sin marcar cada hijo a mano. */
.deck-js .diapositiva.activa .cascada > * {
  animation: surgir 0.6s var(--curva) both;
  animation-delay: calc(var(--i, 0) * 0.09s + 0.12s);
}
.cascada > *:nth-child(1) { --i: 0; }
.cascada > *:nth-child(2) { --i: 1; }
.cascada > *:nth-child(3) { --i: 2; }
.cascada > *:nth-child(4) { --i: 3; }
.cascada > *:nth-child(5) { --i: 4; }
.cascada > *:nth-child(6) { --i: 5; }
.cascada > *:nth-child(7) { --i: 6; }
.cascada > *:nth-child(8) { --i: 7; }
.deck-js .cascada > * { opacity: 0; }

.barra { transform-origin: bottom; }
.deck-js .diapositiva.activa .barra {
  animation: crecer 0.85s var(--curva) both;
  animation-delay: 0.2s;
  opacity: 1;
}
.traza { stroke-dasharray: var(--largo, 1000); }
.deck-js .diapositiva.activa .traza {
  animation: trazar 1.3s var(--curva) both;
  animation-delay: 0.25s;
  opacity: 1;
}
.deck-js .diapositiva.activa .medidor::after {
  animation: llenar 1s var(--curva) both;
  animation-delay: 0.3s;
  opacity: 1;
}
/* Acercamiento lento del fondo: acompana a la diapositiva mientras se lee. */
.deck-js .diapositiva.activa .zoom-lento { animation: acercar 6s var(--curva) both; }

/* Un diagrama se DIBUJA al llegar: marca sus trazos con .traza-auto y el
   sistema los recorre. Es el efecto que hace que un esquema se sienta
   explicado en vez de pegado. */
.deck-js .diagrama .traza-auto { stroke-dasharray: var(--largo, 900); stroke-dashoffset: var(--largo, 900); }
.deck-js .diapositiva.activa .diagrama .traza-auto {
  animation: trazar 1.2s var(--curva) both;
  animation-delay: calc(0.25s + var(--i, 0) * 0.12s);
}
.deck-js .diagrama .surge-auto { opacity: 0; }

/* La orbita se arma al llegar: el anillo se dibuja, el nucleo entra y los
   satelites aparecen en orden alrededor. Sin esto el esquema se veia pegado. */
.deck-js .orbita__satelite { opacity: 0; }
.deck-js .diapositiva.activa .orbita__satelite {
  animation: surgir-escala 0.5s var(--curva) both;
  animation-delay: calc(0.35s + var(--i, 0) * 0.08s);
}
.deck-js .orbita__nucleo { opacity: 0; }
.deck-js .diapositiva.activa .orbita__nucleo {
  animation: surgir-escala 0.6s var(--curva) both;
  animation-delay: 0.15s;
}
.deck-js .orbita::before { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
.deck-js .diapositiva.activa .orbita::before {
  animation: anillo 0.8s var(--curva) both;
  animation-delay: 0.25s;
}
@keyframes anillo {
  from { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
  to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
/* Al pasar el cursor el satelite se separa un poco del centro. */
.orbita__satelite:hover {
  border-color: var(--marca-color-primario);
  box-shadow: var(--sombra-suave);
}
.deck-js .diapositiva.activa .diagrama .surge-auto {
  animation: surgir-escala 0.55s var(--curva) both;
  animation-delay: calc(0.5s + var(--i, 0) * 0.09s);
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  /* El guion sigue instalado porque tambien resuelve maquetacion. Aqui se
     neutraliza solamente el movimiento y se conserva el estado final. */
  .capa, .capa:hover { transform: none; }
  .orbita__satelite, .orbita__nucleo { opacity: 1 !important; animation: none !important; }
  .orbita::before { opacity: 1 !important; animation: none !important; transform: translate(-50%, -50%) !important; }
  .aparece, .palabras > *, .cascada > *, .barra, .traza, .traza-auto, .surge-auto, .zoom-lento, .medidor::after {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    clip-path: none !important;
  }
  .traza, .traza-auto {
    stroke-dasharray: none !important;
    stroke-dashoffset: 0 !important;
  }
  /* Lo que se mueve en bucle se detiene del todo: es la parte que molesta. */
  .halo { animation: none; }
  .tarjeta { transition: none; }
  .tarjeta:hover { transform: none; }
}

/* --- Impresion ---------------------------------------------------------- */
@media print {
  .baraja { height: auto; overflow: visible; }
  .baraja--horizontal { display: block; height: auto; overflow: visible; }
  .baraja--horizontal > .diapositiva { flex-basis: auto; }
  .diapositiva,
  .deck-js .diapositiva { height: auto; min-height: auto; max-height: none; overflow: visible; page-break-after: always; }
  .diapositiva__marco { position: static; height: auto !important; }
  .diapositiva__ajuste { position: relative; inset: auto; transform: none !important; }
  #pulse-salir { display: none; }
}
/* Con WAAPI disponible, el guion posee la coreografia. Estas animaciones CSS
   quedan como degradacion para navegadores antiguos y no deben competir con
   dos transformaciones simultaneas sobre el mismo elemento. */
.deck-waapi .diapositiva.activa .aparece,
.deck-waapi .diapositiva.activa .palabras > *,
.deck-waapi .diapositiva.activa .cascada > * {
  animation: none;
  opacity: 1;
  transform: none;
  filter: none;
  clip-path: none;
}
`;
