import { ProjectEvidenceActions } from './ProjectEvidenceActions';
import { TextField } from "../ui/TextField";
import { useRef, useState } from "react";
import { safeWebUrl } from "../../services/project-web-url";
import { projectHubApi } from "../../services/project-hub-api";
import { useProjectFileUpload } from "../project-hub/useProjectFileUpload";
import { useProjectFileDownload } from "../project-hub/useProjectFileDownload";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import {
  dateLabel,
  record,
  text,
  type DataRecord,
  type DataState,
} from "./dashboard-data";
import { resourceRows } from "./useProjectDashboard";
import { ProjectGlyph } from "./ProjectGlyph";
import { ProjectBrowserCapture } from "./ProjectBrowserCapture";

export function ProjectResources({
  workspaceId,
  projectId,
  kind,
  state,
  canWrite,
  canManage = false,
  onRefresh,
  onOpenWeb,
}: {
  workspaceId: string;
  projectId: string;
  kind: "files" | "web";
  state: DataState<DataRecord[]>;
  canWrite: boolean;
  canManage?: boolean;
  onRefresh: () => void;
  onOpenWeb?: (url: string) => void;
}) {
  const upload = useProjectFileUpload(workspaceId, projectId);
  const download = useProjectFileDownload(workspaceId, projectId);
  const [adding, setAdding] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<DataRecord | null>(null);
  const detailRequest = useRef(0);
  const rows = resourceRows(state.data, kind);
  const openDetail = async (row: DataRecord) => {
    const request = ++detailRequest.current;
    setDetail(row);
    setMessage("");
    try {
      const result = await projectHubApi.getEvidence(
        workspaceId,
        projectId,
        text(row.evidence_id),
      );
      if (detailRequest.current !== request) return;
      if (result.success && result.data) setDetail(result.data);
      else setMessage(result.error || "No se pudo cargar el detalle.");
    } catch {
      if (detailRequest.current === request)
        setMessage("No se pudo cargar el detalle.");
    }
  };
  const save = async () => {
    if (!canWrite || busy) return;
    const valid = safeWebUrl(url);
    if (!valid) {
      setMessage("Introduce una URL http o https sin credenciales.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await projectHubApi.addEvidence(workspaceId, projectId, {
        type: kind === "files" ? "drive_file" : "link",
        source_system: kind === "files" ? "google-drive" : "web",
        title: title.trim(),
        external_reference: valid,
        metadata: { url: valid },
        items: [],
      });
      if (result.success) {
        setAdding(false);
        setTitle("");
        setUrl("");
        onRefresh();
      } else setMessage(result.error || "No se pudo guardar el enlace.");
    } catch {
      setMessage("No se pudo guardar el enlace.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {kind === "web" && canWrite && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setCapturing(true)}
        >
          Guardar investigación del navegador
        </Button>
      )}
      {capturing && (
        <ProjectBrowserCapture
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setCapturing(false)}
          onSaved={() => {
            setCapturing(false);
            onRefresh();
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {kind === "files" ? "Archivos" : "Páginas web"}
        </h2>
        <div className="flex gap-2">
          {kind === "files" && canWrite && (
            <Button
              size="sm"
              disabled={upload.busy}
              onClick={() => void upload.upload().then(onRefresh)}
            >
              Subir archivos
            </Button>
          )}
          {canWrite && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAdding((value) => !value)}
            >
              {kind === "files" ? "Vincular Drive" : "Añadir enlace"}
            </Button>
          )}
        </div>
      </div>
      {adding && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-3"
          >
            <label className="block text-xs">
              Título
              <TextField
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={500}
                className="mt-1 w-full rounded-2xl border border-border bg-surface-2 p-3 text-sm"
              />
            </label>
            <label className="block text-xs">
              URL
              <TextField
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                maxLength={500}
                className="mt-1 w-full rounded-2xl border border-border bg-surface-2 p-3 text-sm"
              />
            </label>
            <p className="text-xs text-secondary">
              Se guardará el enlace en este proyecto. No se comparte la sesión
              del navegador.
            </p>
            <div className="flex gap-2">
              <Button size="sm" type="submit" loading={busy}>
                Guardar enlace
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setAdding(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}
      {(upload.message || download.message || message) && (
        <p role="status" className="text-sm text-secondary">
          {message || download.message || upload.message}
        </p>
      )}
      {upload.busy && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void upload.cancel()}
        >
          Cancelar subida
        </Button>
      )}
      {download.busy && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void download.cancel()}
        >
          Cancelar descarga
        </Button>
      )}
      {detail ? (
        <Card>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              detailRequest.current++;
              setDetail(null);
            }}
          >
            Volver a {kind === "files" ? "archivos" : "páginas web"}
          </Button>
          <h3 className="mt-3 text-base font-semibold">{text(detail.title)}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
            {text(detail.summary)}
          </p>
          <ProjectEvidenceActions key={text(detail.evidence_id)} workspaceId={workspaceId} projectId={projectId} row={detail} canWrite={canWrite} canManage={canManage} onRefresh={()=>{setDetail(null);onRefresh();}}/>
          <div className="mt-3 space-y-2">
            {(Array.isArray(detail.pm_project_evidence_items)
              ? detail.pm_project_evidence_items
              : [detail.metadata]
            ).map((item, index) => {
              const row = record(item);
              const link = safeWebUrl(text(row.source_url) || text(row.url));
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-border p-3"
                >
                  <p className="text-sm">{text(row.title)}</p>
                  {link && (
                    <>
                      <p className="my-2 break-all text-xs text-secondary">
                        {link}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenWeb?.(link)}
                        disabled={!onOpenWeb}
                      >
                        Abrir en navegador
                      </Button>
                    </>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-xs text-secondary">
                    {text(row.content).slice(0, 20000)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      ) : state.loading ? (
        <p className="text-sm text-secondary">Cargando recursos…</p>
      ) : state.error ? (
        <Card>
          <p className="text-sm text-secondary">{state.error}</p>
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            Reintentar
          </Button>
        </Card>
      ) : rows.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <Card key={text(row.evidence_id)}>
              <div className="flex items-center gap-2 text-accent">
                <ProjectGlyph name={kind} />
                <h3 className="text-sm font-semibold">
                  {text(row.title, "Sin título")}
                </h3>
              </div>
              <p className="mt-2 text-xs text-secondary">
                {dateLabel(row.created_at)}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-secondary">
                {text(row.summary)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.evidence_type === "upload" &&
                  record(row.metadata).upload_state === "ready" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={download.busy || upload.busy}
                      onClick={() =>
                        void download.download(text(row.evidence_id))
                      }
                    >
                      Guardar copia
                    </Button>
                  )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void openDetail(row)}
                >
                  Ver detalle
                </Button>
              </div>
              <ProjectEvidenceActions workspaceId={workspaceId} projectId={projectId} row={row} canWrite={canWrite} canManage={canManage} onRefresh={onRefresh}/>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-secondary">
            {kind === "files"
              ? "Aún no hay archivos visibles."
              : "Aún no hay páginas vinculadas."}
          </p>
        </Card>
      )}
      {state.partial && (
        <p className="text-xs text-secondary">
          Hay más recursos disponibles. Usa Cargar más para recorrerlos.
        </p>
      )}
    </div>
  );
}
