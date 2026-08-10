import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserTabStrip } from '../../components/browser/BrowserTabStrip';
import type { IntegratedBrowserTabState } from '../../services/integrated-browser-service';

describe('BrowserTabStrip', () => {
  const tabs: IntegratedBrowserTabState[] = [
    { id: 'tab-1', title: 'Pestaña 1', url: 'https://example.com/1', isLoading: false, error: null, isSuspended: false, isDetached: false },
    { id: 'tab-2', title: 'Pestaña 2', url: 'https://example.com/2', isLoading: false, error: null, isSuspended: false, isDetached: false },
  ];

  it('renders tabs correctly and handles tab click', () => {
    const onActivateTab = vi.fn();
    const onCloseTab = vi.fn();
    const onCreateTab = vi.fn();

    render(
      <BrowserTabStrip
        tabs={tabs}
        activeTabId="tab-1"
        secondaryTabId={null}
        viewMode="single"
        onActivateTab={onActivateTab}
        onCloseTab={onCloseTab}
        onCreateTab={onCreateTab}
        onSetViewMode={vi.fn()}
      />
    );

    expect(screen.getByText('Pestaña 1')).toBeInTheDocument();
    expect(screen.getByText('Pestaña 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Pestaña 2/i }));
    expect(onActivateTab).toHaveBeenCalledWith('tab-2');
  });

  it('calls onCreateTab when plus button is clicked', () => {
    const onCreateTab = vi.fn();

    render(
      <BrowserTabStrip
        tabs={tabs}
        activeTabId="tab-1"
        secondaryTabId={null}
        viewMode="single"
        onActivateTab={vi.fn()}
        onCloseTab={vi.fn()}
        onCreateTab={onCreateTab}
        onSetViewMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nueva pestaña' }));
    expect(onCreateTab).toHaveBeenCalledTimes(1);
  });

  it('calls onCloseTab when close tab button is clicked', () => {
    const onCloseTab = vi.fn();

    render(
      <BrowserTabStrip
        tabs={tabs}
        activeTabId="tab-1"
        secondaryTabId={null}
        viewMode="single"
        onActivateTab={vi.fn()}
        onCloseTab={onCloseTab}
        onCreateTab={vi.fn()}
        onSetViewMode={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Pestaña 1' }));
    expect(onCloseTab).toHaveBeenCalledWith('tab-1');
  });

  describe('reordenar arrastrando', () => {
    /**
     * Reproduce el fallo reportado: al arrastrar una pestana la aplicacion se
     * quedaba EN BLANCO. El canal `integrated-browser:tab-reorder` no estaba en
     * la allowlist, `validateChannel` lanzaba de forma sincrona y esa llamada
     * vivia dentro de un updater de estado, asi que el error se propagaba por
     * la fase de render y desmontaba el arbol entero.
     */
    let reorderTabs: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      reorderTabs = vi.fn().mockResolvedValue({ success: true });
      (window as unknown as { integratedBrowser: unknown }).integratedBrowser = { reorderTabs };
      // jsdom no implementa la captura de puntero.
      Element.prototype.setPointerCapture = vi.fn();
      Element.prototype.releasePointerCapture = vi.fn();
    });

    afterEach(() => {
      delete (window as unknown as { integratedBrowser?: unknown }).integratedBrowser;
    });

    function pintar(onActivateTab = vi.fn()) {
      render(
        <BrowserTabStrip
          tabs={tabs}
          activeTabId="tab-1"
          secondaryTabId={null}
          viewMode="single"
          onActivateTab={onActivateTab}
          onCloseTab={vi.fn()}
          onCreateTab={vi.fn()}
          onSetViewMode={vi.fn()}
        />,
      );
      return onActivateTab;
    }

    /** Contenedor arrastrable de una pestana (el `role="tab"` es su hijo). */
    function contenedor(nombre: RegExp): HTMLElement {
      const boton = screen.getByRole('tab', { name: nombre });
      return boton.parentElement as HTMLElement;
    }

    it('no tumba la interfaz aunque el puente falle', () => {
      // Antes, un fallo del puente durante el arrastre dejaba la app en blanco.
      reorderTabs.mockImplementation(() => { throw new Error('Unauthorized IPC channel'); });
      pintar();
      const primera = contenedor(/Pestaña 1/i);
      primera.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 }) as DOMRect;
      contenedor(/Pestaña 2/i).getBoundingClientRect = () => ({ left: 104, width: 100, right: 204 }) as DOMRect;

      fireEvent.pointerDown(primera, { button: 0, clientX: 50, pointerId: 1 });
      expect(() => fireEvent.pointerMove(window, { clientX: 180, pointerId: 1, buttons: 1 })).not.toThrow();
      fireEvent.pointerUp(window, { clientX: 180, pointerId: 1 });

      expect(screen.getByText('Pestaña 1')).toBeInTheDocument();
    });

    it('avisa a main del nuevo orden al cruzar la mitad de la vecina', () => {
      pintar();
      const primera = contenedor(/Pestaña 1/i);
      primera.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 }) as DOMRect;
      contenedor(/Pestaña 2/i).getBoundingClientRect = () => ({ left: 104, width: 100, right: 204 }) as DOMRect;

      fireEvent.pointerDown(primera, { button: 0, clientX: 50, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 180, pointerId: 1, buttons: 1 });

      expect(reorderTabs).toHaveBeenCalledWith('tab-1', 'tab-2');
    });

    it('termina el arrastre aunque se suelte fuera de la pestana', () => {
      // El fallo reportado: la pestana se quedaba clavada fuera de sitio. El
      // contenido web es una vista NATIVA por encima del renderer, asi que al
      // soltar sobre ella el `pointerup` no llegaba al nodo de la pestana.
      pintar();
      const primera = contenedor(/Pestaña 1/i);
      primera.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 }) as DOMRect;
      contenedor(/Pestaña 2/i).getBoundingClientRect = () => ({ left: 104, width: 100, right: 204 }) as DOMRect;

      fireEvent.pointerDown(primera, { button: 0, clientX: 50, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 180, pointerId: 1, buttons: 1 });
      expect(primera.style.transform).not.toBe('translate3d(0, 0, 0)');

      fireEvent.pointerUp(window, { clientX: 180, pointerId: 1 });

      expect(contenedor(/Pestaña 1/i).style.transform).toBe('translate3d(0, 0, 0)');
    });

    it('suelta la pestana si la ventana pierde el foco', () => {
      pintar();
      const primera = contenedor(/Pestaña 1/i);
      primera.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 }) as DOMRect;

      fireEvent.pointerDown(primera, { button: 0, clientX: 50, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 90, pointerId: 1, buttons: 1 });
      fireEvent.blur(window);

      expect(contenedor(/Pestaña 1/i).style.transform).toBe('translate3d(0, 0, 0)');
    });

    it('suelta la pestana si el navegador retira la captura del puntero', () => {
      pintar();
      const primera = contenedor(/Pestaña 1/i);
      primera.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 }) as DOMRect;

      fireEvent.pointerDown(primera, { button: 0, clientX: 50, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 90, pointerId: 1, buttons: 1 });
      fireEvent.lostPointerCapture(primera, { pointerId: 1 });

      expect(contenedor(/Pestaña 1/i).style.transform).toBe('translate3d(0, 0, 0)');
    });

    it('cierra el arrastre si vuelve el puntero sin boton pulsado', () => {
      // Ocurre al soltar sobre la vista nativa del navegador: el `pointerup`
      // no llega al DOM y el siguiente movimiento ya viene sin boton.
      pintar();
      const primera = contenedor(/Pestaña 1/i);
      primera.getBoundingClientRect = () => ({ left: 0, width: 100, right: 100 }) as DOMRect;

      fireEvent.pointerDown(primera, { button: 0, clientX: 50, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 90, pointerId: 1, buttons: 1 });
      fireEvent.pointerMove(window, { clientX: 95, pointerId: 1, buttons: 0 });

      expect(contenedor(/Pestaña 1/i).style.transform).toBe('translate3d(0, 0, 0)');
    });

    it('un clic sin desplazamiento sigue activando la pestana', () => {
      const onActivateTab = pintar();
      const segunda = contenedor(/Pestaña 2/i);

      fireEvent.pointerDown(segunda, { button: 0, clientX: 150, pointerId: 1 });
      fireEvent.pointerUp(window, { clientX: 151, pointerId: 1 });

      expect(onActivateTab).toHaveBeenCalledWith('tab-2');
      expect(reorderTabs).not.toHaveBeenCalled();
    });

    it('no arrastra con el boton derecho', () => {
      pintar();
      const primera = contenedor(/Pestaña 1/i);

      fireEvent.pointerDown(primera, { button: 2, clientX: 50, pointerId: 1 });
      fireEvent.pointerMove(window, { clientX: 300, pointerId: 1, buttons: 1 });

      expect(reorderTabs).not.toHaveBeenCalled();
    });
  });
});
