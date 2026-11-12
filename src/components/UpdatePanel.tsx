import { useUpdatePanel } from "./update-panel/useUpdatePanel";
import { ChangelogFeatures } from "./update-panel/ChangelogFeatures";
import { HubGlyph, type HubGlyphName } from "./ui/HubGlyph";
import "./update-panel/updates.css";

export function UpdatePanel() {
  const update = useUpdatePanel();
  const failed = Boolean(update.error) || update.state === "error";
  const checking = !failed && (update.checking || update.state === "checking");
  let title = "Listo para comprobar";
  let description = "Consulta si hay una nueva versión para tu aplicación.";
  let icon: HubGlyphName = "refresh";
  let label = "Buscar actualizaciones";
  let action = update.handleCheck;
  if (!update.isAvailable) {
    title = "Vista previa de escritorio";
    description =
      "La búsqueda y la instalación están disponibles en SofLIA Hub.";
  } else if (checking) {
    title = "Buscando actualizaciones";
    description = "Consultando la publicación más reciente de SofLIA Hub.";
    label = "Comprobando…";
  } else if (failed) {
    title = "Necesitamos volver a intentarlo";
    description =
      update.error ||
      update.status?.error ||
      "El servicio de actualizaciones no respondió.";
    icon = "warning";
    label = "Reintentar";
  } else if (update.state === "available") {
    title = "Una nueva versión te espera";
    description = update.availableVersion
      ? "La versión v" +
        update.availableVersion +
        " está disponible para descargar."
      : "Hay una actualización disponible.";
    icon = "download";
    label = "Descargar actualización";
    action = update.handleDownload;
  } else if (update.state === "downloading") {
    title = "Descargando actualización";
    description = "Puedes seguir trabajando mientras termina la descarga.";
    icon = "download";
    label = "Descargando…";
  } else if (update.state === "downloaded") {
    title = "Todo listo para actualizar";
    description = "Reinicia la aplicación para instalar la nueva versión.";
    icon = "check";
    label = "Reiniciar e instalar";
    action = update.handleInstall;
  } else if (update.state === "not-available") {
    title = "Tienes la última versión";
    description = "No hay una versión más reciente disponible en este momento.";
    icon = "check";
  }
  const busy = checking || (update.state === "downloading" && !failed);
  return (
    <div className="updates-layout settings-enter">
      <div className="updates-overview">
        <section
          className="update-build-card"
          aria-labelledby="installed-version-title"
        >
          <div className="update-build-top">
            <span className="settings-eyebrow">Tu aplicación</span>
            <span className="settings-tag">
              <span className="update-status-dot" /> Instalada
            </span>
          </div>
          <div className="update-build-version">
            <div>
              <h3 id="installed-version-title">SofLIA Hub</h3>
              <p>v{update.currentVersion}</p>
            </div>
            <span className="update-build-icon">
              <HubGlyph name="summary" size={34} />
            </span>
          </div>
          <div className="update-build-caption">
            <HubGlyph name="monitor" size={16} /> Aplicación de escritorio
          </div>
        </section>
        <section
          className={
            "update-status-card" + (failed ? " update-status-card--error" : "")
          }
          aria-label="Estado de actualizaciones"
          aria-busy={busy}
        >
          <div
            className={
              "update-state-icon" +
              (checking ? " update-state-icon--checking" : "")
            }
          >
            <HubGlyph name={icon} size={24} />
          </div>
          <div role={failed ? "alert" : "status"} aria-live="polite">
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          {update.state === "downloading" && !failed && (
            <div className="update-download">
              <div className="update-download-label">
                <span>Progreso de descarga</span>
                <strong>{Math.round(update.progress)}%</strong>
              </div>
              <progress
                max={100}
                value={update.progress}
                aria-label="Progreso de descarga"
              />
            </div>
          )}
          <button
            type="button"
            className="settings-primary-action"
            onClick={() => void action()}
            disabled={!update.isAvailable || busy}
          >
            <HubGlyph
              name={
                update.state === "downloaded" && !failed
                  ? "check"
                  : checking
                    ? "refresh"
                    : icon
              }
              size={18}
            />
            {label}
            <HubGlyph name="arrow" size={16} />
          </button>
          <p className="update-check-time">
            {update.lastCheckedAt
              ? "Última comprobación · " +
                new Intl.DateTimeFormat("es", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(update.lastCheckedAt)
              : "Las nuevas versiones se comprueban en segundo plano."}
          </p>
        </section>
        <div className="update-trust-note">
          <HubGlyph name="shield" size={20} />
          <p>
            La instalación conserva la protección de guardado y cierre de SofLIA
            Hub.
          </p>
        </div>
      </div>
      <ChangelogFeatures
        currentVersion={update.currentVersion}
        releaseNotes={update.notes}
        newVersion={update.availableVersion}
      />
    </div>
  );
}
