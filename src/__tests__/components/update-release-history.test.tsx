import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  buildReleaseHistory,
  parseChangelog,
  parseNoteSections,
} from "../../components/update-panel/release-history";
import { ChangelogFeatures } from "../../components/update-panel/ChangelogFeatures";
import { UpdatePanel } from "../../components/UpdatePanel";
import { useUpdatePanel } from "../../components/update-panel/useUpdatePanel";
import { APP_VERSION } from "../../shared/app-version";
import type {
  UpdaterStatus,
  UpdateAvailableInfo,
} from "../../services/updater-service";

const installed: UpdaterStatus = {
  state: "idle",
  currentVersion: APP_VERSION,
  availableVersion: null,
  releaseNotes: null,
  error: null,
  downloadProgress: null,
};
function bridge(status = installed) {
  const dispose = vi.fn();
  const api = {
    getStatus: vi.fn(async () => status),
    checkForUpdates: vi.fn(async () => ({ success: true })),
    downloadUpdate: vi.fn(async () => ({ success: true })),
    installUpdate: vi.fn(async () => ({ success: true })),
    onUpdateAvailable: vi.fn(() => dispose),
    onDownloadProgress: vi.fn(() => dispose),
    onUpdateDownloaded: vi.fn(() => dispose),
    onError: vi.fn(() => dispose),
    removeListeners: vi.fn(),
  };
  Object.defineProperty(window, "updater", { configurable: true, value: api });
  return { api, dispose };
}
afterEach(() => {
  Reflect.deleteProperty(window, "updater");
  vi.restoreAllMocks();
});

describe("historial canónico de publicaciones", () => {
  it("lee la versión de compilación y sus notas del changelog real", () => {
    const entry = buildReleaseHistory(APP_VERSION).find(
      (item) => item.version === APP_VERSION,
    );
    expect(entry?.notes).toContain("Navegador integrado");
    expect(entry?.date).toBeTruthy();
  });
  it("incorpora una versión nueva sin cambiar componentes y excluye Sin publicar", () => {
    const source =
      "## [Sin publicar]\n- Pendiente\n## [12.3.4] - 2030-01-02\n### Novedades\n- Nota futura\n  continúa aquí\n## [12.2.0] - 2029-12-01\n- Anterior";
    const releases = buildReleaseHistory("12.3.4", null, null, source);
    expect(releases.map((item) => item.version)).toEqual(["12.3.4", "12.2.0"]);
    expect(parseNoteSections(releases[0].notes)).toEqual([
      { title: "Novedades", items: ["Nota futura continúa aquí"] },
    ]);
    expect(parseChangelog(source)[0].notes).not.toContain("Pendiente");
  });
  it("no duplica la versión disponible ni confía en otro número dentro de notas remotas", () => {
    const source = "## [1.0.0] - 2026-01-01\n### Novedades\n- Local";
    const releases = buildReleaseHistory(
      "1.0.0",
      "1.0.0",
      "### Mejoras\n- Remota",
      source,
    );
    expect(releases).toHaveLength(1);
    expect(releases[0]).toMatchObject({ version: "1.0.0", date: "2026-01-01" });
    expect(
      buildReleaseHistory(
        "1.0.0",
        "2.0.0",
        "## [99.0.0] - 2026-01-01\n- Dato",
        source,
      )[0].version,
    ).toBe("2.0.0");
  });
  it("muestra una ausencia honesta de notas en una compilación sin publicación", () => {
    render(<ChangelogFeatures currentVersion="98.0.0" />);
    expect(
      screen.getByText("No hay notas publicadas para esta versión."),
    ).toBeTruthy();
    expect(screen.getByRole("combobox")).toHaveTextContent("v98.0.0");
  });
  it("conserva el texto y nunca ejecuta HTML de notas remotas", () => {
    const { container } = render(
      <ChangelogFeatures
        currentVersion="1.0.0"
        newVersion="2.0.0"
        releaseNotes={
          '<h3>Mejoras</h3><img src=x onerror="alert(1)"><li>Texto seguro</li>'
        }
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Texto seguro")).toBeTruthy();
  });
});

it("incluye una versión disponible sin inventar notas cuando el servicio devuelve null", () => {
  render(<ChangelogFeatures currentVersion={APP_VERSION} newVersion="99.0.0" releaseNotes={null} />);
  expect(screen.getByRole('combobox')).toHaveTextContent('v99.0.0');
  expect(screen.getByText('No hay notas publicadas para esta versión.')).toBeTruthy();
});

describe("actualizaciones con estado real", () => {
  it("no dice al día antes de consultar y usa la versión de compilación sin puente", () => {
    render(<UpdatePanel />);
    expect(
      screen.getByRole("heading", { name: "v" + APP_VERSION }),
    ).toBeTruthy();
    expect(screen.getByText("Vista previa de escritorio")).toBeTruthy();
    expect(screen.queryByText("Tienes la última versión")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Buscar actualizaciones" }),
    ).toBeDisabled();
  });
  it("muestra fallo de descarga y habilita reintento sin depender de eventos", async () => {
    const { api } = bridge({
      ...installed,
      state: "available",
      availableVersion: "99.0.0",
    });
    api.downloadUpdate.mockResolvedValue({
      success: false,
      error: "Descarga interrumpida",
    } as never);
    render(<UpdatePanel />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Descargar actualización" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Descarga interrumpida",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });
  it("libera sólo sus suscripciones al cerrar y no elimina las de la notificación", async () => {
    const { api, dispose } = bridge();
    const { unmount } = renderHook(() => useUpdatePanel());
    await act(async () => {});
    unmount();
    expect(dispose).toHaveBeenCalledTimes(4);
    expect(api.removeListeners).not.toHaveBeenCalled();
  });
  it("una respuesta inicial tardía no oculta un evento más reciente", async () => {
    const { api } = bridge();
    let resolve!: (status: UpdaterStatus) => void;
    api.getStatus.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    let onAvailable!: (info: UpdateAvailableInfo) => void;
    api.onUpdateAvailable.mockImplementation(((
      callback: typeof onAvailable,
    ) => {
      onAvailable = callback;
      return vi.fn();
    }) as never);
    const { result } = renderHook(() => useUpdatePanel());
    act(() =>
      onAvailable({
        version: "99.0.0",
        releaseNotes: "Nueva nota",
        releaseDate: "2030-01-01",
      }),
    );
    await act(async () => resolve(installed));
    expect(result.current.state).toBe("available");
    expect(result.current.availableVersion).toBe("99.0.0");
  });
  it("recupera el progreso nativo al abrir durante una descarga", async () => {
    bridge({ ...installed, state: "downloading", downloadProgress: 63.4 });
    render(<UpdatePanel />);
    await waitFor(() =>
      expect(screen.getByRole("progressbar")).toHaveValue(63.4),
    );
    expect(screen.getByText("63%")).toBeTruthy();
  });
});


describe('selector de versiones de SofLIA', () => {
  it('ofrece lista propia, fecha y marca de selección; permite cambiar con teclado', () => {
    render(<ChangelogFeatures currentVersion={APP_VERSION} />);
    const control = screen.getByRole('combobox', { name: 'Versión' });
    fireEvent.click(control);
    const current = screen.getByRole('option', { name: new RegExp('v' + APP_VERSION.replace(/\./g, '\\.')) });
    expect(current).toHaveAttribute('aria-selected', 'true');
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    fireEvent.keyDown(control, { key: 'End' });
    fireEvent.keyDown(control, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
    const entries = buildReleaseHistory(APP_VERSION);
    expect(control).toHaveTextContent('v' + entries[entries.length - 1].version);
  });
});
