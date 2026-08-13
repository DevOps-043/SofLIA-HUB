/* Guion base de las presentaciones de Pulse Hub.
   NO EDITAR: se reescribe en cada generacion. */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducido) return;

  // A partir de aqui el CSS puede ocultar el estado inicial: solo lo hace si
  // esta clase existe, de modo que un fallo del guion nunca esconde contenido.
  raiz.classList.add('deck-js');

  function alEstarListo(accion) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', accion, { once: true });
    else accion();
  }

  alEstarListo(function () {
    var diapositivas = Array.prototype.slice.call(document.querySelectorAll('.diapositiva'));
    if (!diapositivas.length) return;

    // Numera las palabras de los titulares marcados para escalonarlas sin que
    // el modelo tenga que escribir el indice a mano en cada span.
    Array.prototype.forEach.call(document.querySelectorAll('.palabras'), function (bloque) {
      if (bloque.children.length) {
        Array.prototype.forEach.call(bloque.children, function (hijo, indice) {
          hijo.style.setProperty('--i', String(indice));
        });
        return;
      }
      var palabras = (bloque.textContent || '').split(/\s+/).filter(Boolean);
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
    // angulos a mano producia diagramas descuadrados —cuatro satelites
    // amontonados a un lado y hueco en el otro—, que es lo que hacia que el
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
    Array.prototype.forEach.call(document.querySelectorAll('.diagrama'), function (diagrama) {
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

    if (typeof IntersectionObserver !== 'function') {
      // Sin observador se muestran todas: es preferible a una baraja en blanco.
      diapositivas.forEach(function (slide) { slide.classList.add('activa'); });
      return;
    }

    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('activa');
          return;
        }
        // Al salir se retira para que la entrada se repita al volver: una
        // presentacion se recorre hacia delante y hacia atras.
        entrada.target.classList.remove('activa');
      });
    }, { threshold: 0.35 });

    diapositivas.forEach(function (slide) { observador.observe(slide); });

    // La primera se activa de inmediato: al cargar ya esta en pantalla y
    // esperar al observador deja un parpadeo inicial.
    diapositivas[0].classList.add('activa');

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
      var vigilante = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (entrada) { if (entrada.isIntersecting) contar(); });
      }, { threshold: 0.35 });
      vigilante.observe(slide);
    });

    // Ajuste a la ventana: si el contenido de una diapositiva no cabe, se
    // reduce hasta que quepa. Sin esto, en la baraja horizontal —que no puede
    // desplazarse en vertical— el titulo quedaba cortado por arriba o por
    // abajo, y en la vertical el contenido aparecia empujado fuera de vista.
    var ENVOLTORIO = 'diapositiva__ajuste';

    function envolverContenido(slide) {
      if (slide.querySelector(':scope > .' + ENVOLTORIO)) return slide.querySelector(':scope > .' + ENVOLTORIO);
      var caja = document.createElement('div');
      caja.className = ENVOLTORIO;
      var sueltos = [];
      Array.prototype.forEach.call(slide.children, function (hijo) {
        // El fondo, el halo y la retícula no son contenido: no se escalan.
        if (hijo.classList.contains('imagen-fondo')) return;
        if (hijo.classList.contains('halo')) return;
        if (hijo.classList.contains('plano')) return;
        sueltos.push(hijo);
      });
      if (!sueltos.length) return null;
      slide.insertBefore(caja, sueltos[0]);
      sueltos.forEach(function (hijo) { caja.appendChild(hijo); });
      return caja;
    }

    function ajustar(slide) {
      var caja = slide.querySelector(':scope > .' + ENVOLTORIO);
      if (!caja) return;
      caja.style.transform = '';
      // clientHeight incluye el relleno, y el contenido vive dentro de el:
      // restarlo evita escalar de menos y que siga sin caber.
      var estilo = window.getComputedStyle(slide);
      var relleno = parseFloat(estilo.paddingTop || '0') + parseFloat(estilo.paddingBottom || '0');
      var disponible = slide.clientHeight - relleno - 2;
      var necesario = caja.scrollHeight;
      if (!disponible || necesario <= disponible) return;
      // Suelo del 50%: por debajo el problema es que sobra contenido. Con un
      // panel estrecho una diapositiva crece mucho, y quedarse corto aqui es
      // lo que dejaba el titulo fuera de la pantalla.
      var factor = Math.max(0.5, disponible / necesario);
      caja.style.transform = 'scale(' + factor.toFixed(3) + ')';
    }

    var pendiente = null;
    function ajustarTodas() {
      if (pendiente) cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(function () { diapositivas.forEach(ajustar); });
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

    // Y ante cualquier otro cambio de altura: fuentes que terminan de cargar,
    // un contador que ensancha su linea, una tarjeta que se despliega.
    if (typeof ResizeObserver === 'function') {
      var vigilanteAltura = new ResizeObserver(ajustarTodas);
      diapositivas.forEach(function (slide) {
        var caja = slide.querySelector(':scope > .' + ENVOLTORIO);
        if (caja) vigilanteAltura.observe(caja);
      });
    }

    window.addEventListener('resize', ajustarTodas);

    // Baraja horizontal: la rueda del raton desplaza en vertical y sin esto la
    // presentacion parece congelada.
    var horizontal = document.querySelector('.baraja--horizontal');
    if (horizontal) {
      horizontal.tabIndex = 0;
      horizontal.addEventListener('wheel', function (evento) {
        if (Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) return;
        evento.preventDefault();
        horizontal.scrollBy({ left: evento.deltaY, behavior: 'auto' });
      }, { passive: false });
    }
  });
})();
