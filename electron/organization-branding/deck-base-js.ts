/**
 * Guion base de la baraja. Lo escribe el sistema junto a la hoja de marca y el
 * sistema de diseno, y el modelo no puede tocarlo.
 *
 * Existe por un motivo concreto: las animaciones de entrada estaban ligadas al
 * scroll (`animation-timeline: view()`), y con `scroll-snap` el salto de una
 * diapositiva a la siguiente RECORRE ENTERO el rango de entrada en el tiempo
 * que dura el salto. La animacion ocurria, pero de forma imperceptible: el
 * usuario veia el contenido ya colocado. Ligarlas a un observador y dispararlas
 * por tiempo cuando la diapositiva entra en pantalla es lo que las hace
 * visibles, y ademas devuelve los retardos escalonados, que sobre una linea de
 * tiempo de scroll no se aplican.
 *
 * Degradacion: la clase `deck-js` la pone este guion. Sin el, el CSS deja todo
 * visible y estatico. Una presentacion nunca se queda en blanco por esto.
 */
export const DECK_BASE_JS = `/* Guion base de las presentaciones de Pulse Hub.
   NO EDITAR: se reescribe en cada generacion. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A partir de aqui el CSS puede ocultar el estado inicial: solo lo hace si
  // esta clase existe, de modo que un fallo del guion nunca esconde contenido.
  // Se instala tambien con movimiento reducido: ajustar el contenido a la
  // ventana es maquetacion, no una animacion.
  raiz.classList.add('deck-js');
  if (!reducido && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function') {
    raiz.classList.add('deck-waapi');
  }

  function alEstarListo(accion) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', accion, { once: true });
    else accion();
  }

  alEstarListo(function () {
    var diapositivas = Array.prototype.slice.call(document.querySelectorAll('.diapositiva'));
    if (!diapositivas.length) return;

    // Una ilustracion que ocupa el fondo necesita siempre la pareja de
    // contraste del sistema. El modelo puede olvidar la clase semantica, pero
    // no por eso debe quedar texto oscuro sobre una imagen tintada.
    diapositivas.forEach(function (slide) {
      if (!slide.querySelector(':scope > .imagen-fondo')) return;
      slide.classList.add('diapositiva--imagen');
      Array.prototype.forEach.call(slide.querySelectorAll('*'), function (nodo) {
        var color = window.getComputedStyle(nodo).backgroundColor;
        var fondo = color.match(/[\\d.]+/g);
        if (!fondo || fondo.length < 3) return;
        var componentes = fondo.map(Number);
        var esSrgb = color.indexOf('color(srgb') === 0;
        var rojo = componentes[0];
        var verde = componentes[1];
        var azul = componentes[2];
        var alfa = componentes.length > 3 ? componentes[3] : 1;
        if (esSrgb) { rojo *= 255; verde *= 255; azul *= 255; }
        var luminosidad = (0.2126 * rojo + 0.7152 * verde + 0.0722 * azul) / 255;
        if (alfa >= 0.55 && luminosidad >= 0.72) nodo.classList.add('superficie--clara-auto');
      });
    });

    // Numera las palabras de los titulares marcados para escalonarlas sin que
    // el modelo tenga que escribir el indice a mano en cada span.
    if (!reducido) Array.prototype.forEach.call(document.querySelectorAll('.palabras'), function (bloque) {
      if (bloque.children.length) {
        Array.prototype.forEach.call(bloque.children, function (hijo, indice) {
          hijo.style.setProperty('--i', String(indice));
        });
        return;
      }
      var palabras = (bloque.textContent || '').split(/\\s+/).filter(Boolean);
      bloque.textContent = '';
      palabras.forEach(function (palabra, indice) {
        var span = document.createElement('span');
        span.textContent = palabra;
        span.style.setProperty('--i', String(indice));
        bloque.appendChild(span);
        if (indice < palabras.length - 1) bloque.appendChild(document.createTextNode(' '));
      });
    });

    // Orbitas: reparte los satelites por igual y los numera. Calcular los
    // angulos a mano producia diagramas descuadrados â€”cuatro satelites
    // amontonados a un lado y hueco en el otroâ€”, que es lo que hacia que el
    // esquema se viera mal aunque el resto de la diapositiva estuviera bien.
    Array.prototype.forEach.call(document.querySelectorAll('.orbita'), function (orbita) {
      var satelites = Array.prototype.filter.call(orbita.children, function (hijo) {
        return hijo.classList.contains('orbita__satelite');
      });
      var total = satelites.length;
      satelites.forEach(function (satelite, indice) {
        satelite.style.setProperty('--i', String(indice));
        // Un angulo escrito a mano manda: el reparto solo cubre lo que falta.
        if (!satelite.style.getPropertyValue('--angulo') && !satelite.hasAttribute('data-angulo')) {
          satelite.style.setProperty('--angulo', String(Math.round((360 / total) * indice)));
        }
      });
    });

    // Numera los trazos y las piezas de cada diagrama para que se dibujen en
    // orden sin que haya que escribir el indice uno por uno.
    if (!reducido) Array.prototype.forEach.call(document.querySelectorAll('.diagrama'), function (diagrama) {
      Array.prototype.forEach.call(diagrama.querySelectorAll('.traza-auto, .surge-auto'), function (pieza, indice) {
        if (!pieza.style.getPropertyValue('--i')) pieza.style.setProperty('--i', String(indice));
        // Longitud real del trazo: sin ella, stroke-dasharray usa un valor
        // por defecto y el dibujado se ve entrecortado o instantaneo.
        if (pieza.classList.contains('traza-auto') && typeof pieza.getTotalLength === 'function') {
          try {
            var largo = Math.ceil(pieza.getTotalLength());
            if (largo > 0) pieza.style.setProperty('--largo', String(largo));
          } catch (error) { /* nodos sin geometria: se queda el valor por defecto */ }
        }
      });
    });

    var animaciones = [];
    activarEntradas();

    function activarEntradas() {
      if (reducido || typeof IntersectionObserver !== 'function') {
        // Sin observador, o sin movimiento, se muestra todo. La maquetacion que
        // sigue debe ejecutarse siempre: por eso no hay un retorno de la rutina.
        diapositivas.forEach(function (slide) { slide.classList.add('activa'); });
        return;
      }

      var observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('activa');
            reproducirMovimiento(entrada.target);
            return;
          }
          // Al salir se retira para que la entrada se repita al volver: una
          // presentacion se recorre hacia delante y hacia atras.
          entrada.target.classList.remove('activa');
          limpiarMovimiento(entrada.target);
        });
      }, { threshold: 0.35 });

      diapositivas.forEach(function (slide) { observador.observe(slide); });
      diapositivas[0].classList.add('activa');
      reproducirMovimiento(diapositivas[0]);

      // IntersectionObserver puede entregar estados intermedios durante el
      // scroll-snap horizontal: por unas decimas ninguna diapositiva supera el
      // umbral y todo el contenido animado queda invisible. El desplazamiento
      // de la propia baraja confirma siempre la diapositiva mas cercana al
      // centro. Asi la navegacion por rueda, teclado o scrollIntoView nunca
      // termina en un lienzo vacio.
      var baraja = diapositivas[0].parentElement;
      if (!baraja) return;
      var activacionPendiente = null;
      var auditoriaNavegacion = null;

      function activarMasCercana() {
        activacionPendiente = null;
        var rectBaraja = baraja.getBoundingClientRect();
        var horizontal = baraja.classList.contains('baraja--horizontal');
        var centro = horizontal
          ? rectBaraja.left + rectBaraja.width / 2
          : rectBaraja.top + rectBaraja.height / 2;
        var cercana = diapositivas[0];
        var distancia = Infinity;

        diapositivas.forEach(function (slide) {
          var rect = slide.getBoundingClientRect();
          var centroSlide = horizontal
            ? rect.left + rect.width / 2
            : rect.top + rect.height / 2;
          var diferencia = Math.abs(centroSlide - centro);
          if (diferencia < distancia) {
            distancia = diferencia;
            cercana = slide;
          }
        });

        cercana.classList.add('activa');
        reproducirMovimiento(cercana);
        if (auditoriaNavegacion) clearTimeout(auditoriaNavegacion);
        // Espera a que concluyan los retardos de entrada para no confundir el
        // estado inicial de una animacion con una diapositiva vacia.
        auditoriaNavegacion = setTimeout(auditar, 900);
      }

      function programarActivacion() {
        if (activacionPendiente) cancelAnimationFrame(activacionPendiente);
        activacionPendiente = requestAnimationFrame(activarMasCercana);
      }

      baraja.addEventListener('scroll', programarActivacion, { passive: true });
      window.addEventListener('resize', programarActivacion);
      programarActivacion();
    }

    // Coreografia editorial del SISTEMA. No depende de que el modelo elija
    // quince keyframes distintos: el rol semantico del elemento determina el
    // gesto, el orden y la curva. Element.animate es parte del navegador y
    // conserva el HTML autocontenido, sin CDN ni un bundle de terceros.
    function reproducirMovimiento(slide) {
      if (reducido || typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return;
      if (slide.getAttribute('data-pulse-movimiento') === 'reproduciendo') return;
      limpiarMovimiento(slide);
      slide.setAttribute('data-pulse-movimiento', 'reproduciendo');

      var elementos = elementosAnimables(slide);
      elementos.forEach(function (nodo, indice) {
        var retardo = retardoDe(nodo, indice);
        var movimiento = movimientoDe(nodo);
        var animacion = nodo.animate(movimiento.fotogramas, {
          duration: movimiento.duracion,
          delay: retardo,
          easing: movimiento.curva,
          fill: 'both',
        });
        animacion.__pulseSlide = slide;
        animaciones.push(animacion);
      });
    }

    function limpiarMovimiento(slide) {
      animaciones = animaciones.filter(function (animacion) {
        if (animacion.__pulseSlide !== slide) return true;
        try { animacion.cancel(); } catch (error) { /* animacion ya terminada */ }
        return false;
      });
      slide.removeAttribute('data-pulse-movimiento');
    }

    function elementosAnimables(slide) {
      var selector = [
        '.antetitulo', '.titular', '.titular--grande', '.subtitulo', '.cuerpo',
        '.cifra', '.figura', 'figure', '.tarjeta', '.flujo', '.orbita', '.diagrama',
        '.tabla', 'table', '.lista', '.bloque', '.cota', '.pie', '[data-movimiento]',
      ].join(',');
      var candidatos = Array.prototype.slice.call(slide.querySelectorAll(selector));
      return candidatos.filter(function (nodo) {
        if (nodo.closest('.imagen-fondo')) return false;
        return !candidatos.some(function (otro) { return otro !== nodo && otro.contains(nodo); });
      }).slice(0, 12);
    }

    function retardoDe(nodo, indice) {
      var explicito = (nodo.className || '').toString().match(/retardo-(\\d)/);
      if (explicito) return Math.min(parseInt(explicito[1], 10) * 95, 570);
      if (nodo.classList.contains('antetitulo')) return 40;
      if (nodo.matches('.titular, .titular--grande')) return 110;
      if (nodo.classList.contains('pie')) return 420;
      return Math.min(170 + indice * 75, 620);
    }

    function movimientoDe(nodo) {
      var suave = 'cubic-bezier(0.22, 1, 0.36, 1)';
      var editorial = 'cubic-bezier(0.16, 1, 0.3, 1)';
      var tipo = nodo.getAttribute('data-movimiento') || '';
      if (tipo === 'ninguno') return { fotogramas: [{ opacity: 1 }, { opacity: 1 }], duracion: 1, curva: 'linear' };
      if (nodo.classList.contains('antetitulo') || tipo === 'linea') {
        return { fotogramas: [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], duracion: 620, curva: editorial };
      }
      if (nodo.matches('.titular, .titular--grande') || tipo === 'titular') {
        return { fotogramas: [{ opacity: 0, transform: 'translate3d(0, 28px, 0)', letterSpacing: '-0.01em' }, { opacity: 1, transform: 'translate3d(0, 0, 0)', letterSpacing: '' }], duracion: 760, curva: editorial };
      }
      if (nodo.matches('.figura, figure, .diagrama, .orbita') || tipo === 'visual') {
        return { fotogramas: [{ opacity: 0, transform: 'translate3d(20px, 0, 0) scale(0.985)' }, { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }], duracion: 840, curva: suave };
      }
      if (nodo.matches('.cifra, .tarjeta, .bloque') || tipo === 'pieza') {
        return { fotogramas: [{ opacity: 0, transform: 'translate3d(0, 18px, 0) scale(0.975)' }, { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }], duracion: 620, curva: suave };
      }
      return { fotogramas: [{ opacity: 0, transform: 'translate3d(0, 16px, 0)' }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }], duracion: 560, curva: suave };
    }

    // Contadores: cualquier elemento con data-contador sube hasta su valor
    // cuando su diapositiva se activa. Es el efecto que mas eleva una cifra.
    var contadores = Array.prototype.slice.call(document.querySelectorAll('[data-contador]'));
    contadores.forEach(function (nodo) {
      var destino = parseFloat(nodo.getAttribute('data-contador'));
      if (!isFinite(destino)) return;
      var decimales = (nodo.getAttribute('data-decimales') || '0').length ? parseInt(nodo.getAttribute('data-decimales') || '0', 10) : 0;
      var prefijo = nodo.getAttribute('data-prefijo') || '';
      var sufijo = nodo.getAttribute('data-sufijo') || '';
      var slide = nodo.closest('.diapositiva');
      var animado = false;
      if (reducido) {
        nodo.textContent = prefijo + destino.toFixed(decimales) + sufijo;
        return;
      }
      nodo.textContent = prefijo + (0).toFixed(decimales) + sufijo;

      function contar() {
        if (animado) return;
        animado = true;
        var inicio = 0;
        var duracion = 1100;
        function paso(marca) {
          if (!inicio) inicio = marca;
          var avance = Math.min((marca - inicio) / duracion, 1);
          // Suavizado de salida: rapido al principio, se asienta al final.
          var suave = 1 - Math.pow(1 - avance, 3);
          nodo.textContent = prefijo + (destino * suave).toFixed(decimales) + sufijo;
          if (avance < 1) requestAnimationFrame(paso);
        }
        requestAnimationFrame(paso);
      }

      if (!slide) { contar(); return; }
      if (typeof IntersectionObserver !== 'function') { contar(); return; }
      var vigilante = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) { if (entrada.isIntersecting) contar(); });
      }, { threshold: 0.35 });
      vigilante.observe(slide);
    });

    // Ajuste a la ventana: si el contenido de una diapositiva no cabe, se
    // reduce hasta que quepa. Sin esto, en la baraja horizontal â€”que no puede
    // desplazarse en verticalâ€” el titulo quedaba cortado por arriba o por
    // abajo, y en la vertical el contenido aparecia empujado fuera de vista.
    var MARCO = 'diapositiva__marco';
    var ENVOLTORIO = 'diapositiva__ajuste';

    function envolverContenido(slide) {
      var existente = slide.querySelector(':scope > .' + MARCO + ' > .' + ENVOLTORIO);
      if (existente) return existente;
      var marco = document.createElement('div');
      marco.className = MARCO;
      var caja = document.createElement('div');
      caja.className = ENVOLTORIO;
      var sueltos = [];
      Array.prototype.forEach.call(slide.children, function (hijo) {
        // El fondo, el halo y la retÃ­cula no son contenido: no se escalan.
        if (hijo.classList.contains('imagen-fondo')) return;
        if (hijo.classList.contains('halo')) return;
        if (hijo.classList.contains('plano')) return;
        sueltos.push(hijo);
      });
      if (!sueltos.length) return null;
      slide.insertBefore(marco, sueltos[0]);
      marco.appendChild(caja);
      sueltos.forEach(function (hijo) { caja.appendChild(hijo); });
      // Al mover el contenido dentro del marco, los selectores de hijo directo
      // que escriba el autor dejan de coincidir. Se copia la alineacion
      // calculada del lienzo para conservar la composicion original.
      var estiloSlide = window.getComputedStyle(slide);
      caja.style.alignItems = estiloSlide.alignItems;
      caja.style.justifyItems = estiloSlide.justifyItems;
      caja.style.alignContent = estiloSlide.alignContent;
      caja.style.justifyContent = estiloSlide.justifyContent;
      return caja;
    }

    function ajustar(slide) {
      var caja = slide.querySelector(':scope > .' + MARCO + ' > .' + ENVOLTORIO);
      if (!caja) return;
      var marco = caja.parentElement;
      caja.style.transform = '';
      marco.style.height = '';
      // clientHeight incluye el relleno, y el contenido vive dentro de el:
      // restarlo evita escalar de menos y que siga sin caber.
      var estilo = window.getComputedStyle(slide);
      var rellenoSuperior = parseFloat(estilo.paddingTop || '0');
      var rellenoInferior = parseFloat(estilo.paddingBottom || '0');
      var relleno = rellenoSuperior + rellenoInferior;
      // El marco sale del grid de la diapositiva para que cada lienzo calcule
      // su posicion vertical de forma independiente dentro del flex horizontal.
      marco.style.left = '0px';
      marco.style.right = '0px';
      // Se mide contra la ventana de la baraja. Si la diapositiva crecio con su
      // contenido y se mide contra si misma, siempre concluye que todo cabe.
      var baraja = slide.parentElement;
      var visible = baraja ? baraja.clientHeight : window.innerHeight;
      var alto = visible ? Math.min(slide.clientHeight, visible) : slide.clientHeight;
      var disponible = alto - relleno - 2;
      var natural = medir(caja);
      if (!disponible || natural <= disponible) {
        aplicar(caja, marco, 1, natural, disponible, rellenoSuperior, slide);
        slide.removeAttribute('data-pulse-ajuste');
        return;
      }

      var SUELO = 0.5;
      // El ancho no cambia, por lo que la altura natural es estable y permite
      // obtener el mayor factor que cabe con una relacion directa. El suelo
      // conserva una salida legible y deja scroll interno para casos extremos.
      var factor = Math.max(SUELO, Math.min(1, disponible / natural));
      aplicar(caja, marco, factor, natural, disponible, rellenoSuperior, slide);
      slide.setAttribute('data-pulse-ajuste', factor.toFixed(3));
    }

    function medir(caja) {
      return caja.scrollHeight;
    }

    // El marco ocupa la altura visual exacta y la caja se pinta dentro de el.
    // Usar transform directamente sobre una caja en flujo dejaba su altura
    // original; usar zoom en una baraja horizontal acumulaba un desplazamiento
    // vertical en Chromium. El marco explicito evita ambos fallos.
    function aplicar(caja, marco, factor, natural, disponible, rellenoSuperior, slide) {
      var visual = natural * factor;
      caja.style.transform = factor >= 0.999 ? '' : 'scale(' + factor.toFixed(3) + ')';
      marco.style.height = Math.ceil(visual) + 'px';
      var local = Math.max(rellenoSuperior, rellenoSuperior + (disponible - visual) / 2);
      // offsetTop de un hijo absoluto dentro de un item flex horizontal puede
      // incluir el desplazamiento de otro item. Se corrige contra el propio
      // lienzo hasta que el marco quede en su coordenada local.
      marco.style.top = '0px';
      var deriva = marco.getBoundingClientRect().top - slide.getBoundingClientRect().top;
      marco.style.top = (local - deriva) + 'px';
    }

    var pendiente = null;
    function ajustarTodas() {
      if (pendiente) cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(function () {
        diapositivas.forEach(ajustar);
        setTimeout(auditar, 0);
      });
    }

    diapositivas.forEach(envolverContenido);
    ajustarTodas();

    // Las ilustraciones aun no han cargado en DOMContentLoaded: medir ahora da
    // una altura menor que la real, no se escala nada, y al aparecer la imagen
    // el contenido desborda y el texto queda fuera de la pantalla. Por eso se
    // vuelve a medir cuando cada imagen termina y cuando termina la pagina.
    Array.prototype.forEach.call(document.images, function (imagen) {
      if (imagen.complete) return;
      imagen.addEventListener('load', ajustarTodas, { once: true });
      imagen.addEventListener('error', ajustarTodas, { once: true });
    });
    window.addEventListener('load', ajustarTodas);

    window.addEventListener('resize', ajustarTodas);

    // Auditoria observable para QA y para soporte. No bloquea una reunion: la
    // baraja sigue visible, pero deja un informe determinista en el documento.
    function auditar() {
      var incidencias = [];
      diapositivas.forEach(function (slide, indice) {
        var numero = indice + 1;
        var rectSlide = slide.getBoundingClientRect();
        var caja = slide.querySelector(':scope > .' + MARCO + ' > .' + ENVOLTORIO);
        var rectCaja = caja ? caja.getBoundingClientRect() : null;
        if (rectCaja && (rectCaja.top < rectSlide.top - 2 || rectCaja.bottom > rectSlide.bottom + 2)) {
          incidencias.push({ diapositiva: numero, codigo: 'contenido-fuera-del-lienzo' });
        }

        var ajuste = parseFloat(slide.getAttribute('data-pulse-ajuste') || '1');
        if (isFinite(ajuste) && ajuste < 0.82) {
          incidencias.push({ diapositiva: numero, codigo: 'ajuste-excesivo', factor: ajuste });
        }

        Array.prototype.forEach.call(slide.querySelectorAll('img'), function (imagen) {
          if (imagen.complete && imagen.naturalWidth === 0) {
            incidencias.push({ diapositiva: numero, codigo: 'imagen-rota', recurso: imagen.getAttribute('src') || '' });
          }
        });

        var titular = slide.querySelector('.titular, .titular--grande, h1, h2');
        if (titular) {
          var estiloTitular = window.getComputedStyle(titular);
          var interlineado = parseFloat(estiloTitular.lineHeight || '0');
          // clientHeight pertenece a la maquetacion natural; el rectangulo ya
          // viene escalado y subestimaria el numero de lineas precisamente en
          // las diapositivas mas densas.
          if (interlineado && titular.clientHeight / interlineado > 3.25) {
            incidencias.push({ diapositiva: numero, codigo: 'titular-de-mas-de-tres-lineas' });
          }
        }

        if (slide.classList.contains('activa')) {
          var raizContenido = caja || slide;
          var visibles = Array.prototype.some.call(raizContenido.querySelectorAll('*'), function (nodo) {
            if (/^(SCRIPT|STYLE|LINK)$/.test(nodo.tagName)) return false;
            if (nodo.classList.contains('imagen-fondo') || nodo.classList.contains('halo') || nodo.classList.contains('plano')) return false;
            var tieneContenido = /^(IMG|SVG|CANVAS|VIDEO|TABLE)$/.test(nodo.tagName) || (nodo.textContent || '').trim().length > 0;
            if (!tieneContenido) return false;
            var estiloNodo = window.getComputedStyle(nodo);
            var rectNodo = nodo.getBoundingClientRect();
            return estiloNodo.display !== 'none' && parseFloat(estiloNodo.opacity || '1') > 0.05 && rectNodo.width > 2 && rectNodo.height > 2;
          });
          if (!visibles && (slide.textContent || '').trim()) {
            incidencias.push({ diapositiva: numero, codigo: 'diapositiva-activa-sin-contenido-visible' });
          }
        }
      });

      raiz.setAttribute('data-pulse-calidad', incidencias.length ? 'advertencias' : 'ok');
      window.__PULSE_DECK_REPORT__ = { ok: incidencias.length === 0, incidencias: incidencias };
      if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
        window.parent.postMessage({ tipo: 'pulse-presentacion-calidad', informe: window.__PULSE_DECK_REPORT__ }, '*');
      }
      if (incidencias.length && window.console && typeof window.console.warn === 'function') {
        window.console.warn('[Presentacion] Incidencias de calidad', incidencias);
      }
    }

    window.addEventListener('load', function () { setTimeout(auditar, 250); });

    // Navegacion discreta: un gesto fisico de rueda produce una rafaga de
    // eventos. Convertir cada evento en pixeles hacia que una sola accion
    // atravesara dos diapositivas (impares al avanzar, pares al volver).
    var horizontal = document.querySelector('.baraja--horizontal');
    if (horizontal) {
      horizontal.tabIndex = 0;
      var indiceActual = 0;
      var navegacionBloqueada = false;
      var desbloqueo = null;

      function indiceVisible() {
        var ancho = horizontal.clientWidth || window.innerWidth || 1;
        return Math.max(0, Math.min(diapositivas.length - 1, Math.round(horizontal.scrollLeft / ancho)));
      }

      function navegar(delta) {
        if (navegacionBloqueada) return;
        indiceActual = indiceVisible();
        var siguiente = Math.max(0, Math.min(diapositivas.length - 1, indiceActual + delta));
        if (siguiente === indiceActual) return;
        navegacionBloqueada = true;
        indiceActual = siguiente;
        horizontal.scrollTo({
          left: siguiente * horizontal.clientWidth,
          behavior: reducido ? 'auto' : 'smooth',
        });
        if (desbloqueo) clearTimeout(desbloqueo);
        desbloqueo = setTimeout(function () { navegacionBloqueada = false; }, reducido ? 100 : 620);
      }

      horizontal.addEventListener('wheel', function (evento) {
        var delta = Math.abs(evento.deltaY) >= Math.abs(evento.deltaX) ? evento.deltaY : evento.deltaX;
        if (Math.abs(delta) < 18) return;
        evento.preventDefault();
        navegar(delta > 0 ? 1 : -1);
      }, { passive: false });

      window.addEventListener('keydown', function (evento) {
        if (evento.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test((evento.target && evento.target.tagName) || '')) return;
        if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].indexOf(evento.key) >= 0) {
          evento.preventDefault(); navegar(1);
        } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].indexOf(evento.key) >= 0) {
          evento.preventDefault(); navegar(-1);
        } else if (evento.key === 'Home') {
          evento.preventDefault(); indiceActual = 0; horizontal.scrollTo({ left: 0, behavior: reducido ? 'auto' : 'smooth' });
        } else if (evento.key === 'End') {
          evento.preventDefault(); indiceActual = diapositivas.length - 1; horizontal.scrollTo({ left: indiceActual * horizontal.clientWidth, behavior: reducido ? 'auto' : 'smooth' });
        }
      });

      horizontal.addEventListener('scroll', function () {
        if (!navegacionBloqueada) indiceActual = indiceVisible();
      }, { passive: true });
    }
  });
})();
`;

