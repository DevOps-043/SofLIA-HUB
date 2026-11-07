import { useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import { safeWebUrl } from "../../services/project-web-url";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { text, type DataRecord } from "./dashboard-data";
import {
  Choice,
  Field,
  fieldClass,
  MoreButton,
  MutationNotice,
} from "./ManagementControls";
import { useProjectMutation } from "./management-state";
import { useProjectCollection } from "./useProjectCollection";

const types = [
  { id: "document", name: "Documento" },
  { id: "spreadsheet", name: "Hoja de cálculo" },
  { id: "presentation", name: "Presentación" },
  { id: "folder", name: "Carpeta" },
  { id: "other", name: "Otro" },
];
const providers = [
  { id: "google_drive", name: "Google Drive" },
  { id: "google_docs", name: "Google Docs" },
  { id: "google_sheets", name: "Google Sheets" },
  { id: "internal", name: "Otro enlace" },
];
export function ProjectDocuments({
  workspaceId,
  projectId,
  canWrite,
  canManage,
  onRefresh,
  onOpenWeb,
  taskId,
}: {
  workspaceId: string;
  projectId: string;
  canWrite: boolean;
  canManage: boolean;
  onRefresh: () => void;
  onOpenWeb?: (url: string) => void;
  taskId?: string;
}) {
  const target = { workspaceId, projectId };
  const [search, setSearch] = useState(""),
    [typeFilter, setTypeFilter] = useState("");
  const list = useProjectCollection(
    JSON.stringify([workspaceId, projectId, taskId, search]),
    (cursor) =>
      taskId
        ? projectHubApi.listTaskDocuments({
            ...target,
            taskId,
            search: search || undefined,
            cursor,
          })
        : projectHubApi.listDocuments({
            ...target,
            search: search || undefined,
            cursor,
          }),
    "id",
  );
  const [editing, setEditing] = useState<DataRecord | null>(null),
    [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [provider, setProvider] = useState("google_drive"),
    [docType, setDocType] = useState("document"),
    [unlink, setUnlink] = useState(false);
  const mutation = useProjectMutation();
  const refresh = () => {
    list.reload();
    onRefresh();
  };
  const edit = (row: DataRecord) => {
    setEditing(row);
    setName(text(row.name));
    setUrl(text(row.external_url));
    setProvider(text(row.provider, "google_drive"));
    setDocType(text(row.doc_type, "document"));
    setUnlink(false);
  };
  const save = () => {
    const valid = safeWebUrl(url);
    if (!valid) return;
    const document = {
      name: name.trim(),
      provider: provider as "google_drive",
      external_id: valid,
      external_url: valid,
      doc_type: docType as "document",
    };
    const updates = {
      ...target,
      documentId: text(editing?.id),
      updates: { name: name.trim(), doc_type: docType as "document" },
      expectedUpdatedAt: text(editing?.updated_at) || undefined,
    };
    void mutation.run(
      () =>
        editing?.id
          ? taskId
            ? projectHubApi.updateTaskDocument({ ...updates, taskId })
            : projectHubApi.updateDocument(updates)
          : taskId
            ? projectHubApi.createTaskDocument({ ...target, taskId, document })
            : projectHubApi.createDocument({ ...target, document }),
      () => {
        setEditing(null);
        refresh();
      },
    );
  };
  const remove = (row: DataRecord) => {
    const input = {
      ...target,
      documentId: text(row.id),
      expectedUpdatedAt: text(row.updated_at) || undefined,
    };
    return taskId
      ? projectHubApi.removeTaskDocument({ ...input, taskId })
      : projectHubApi.removeDocument(input);
  };

  return (
    <section className="space-y-4" aria-label="Documentos vinculados">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Documentos y carpetas vinculados</h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(null);
              refresh();
            }}
          >
            Actualizar documentos
          </Button>
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={() => edit({})}>
              Vincular documento
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Buscar documentos">
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={fieldClass}
          />
        </Field>
        <Choice
          label="Tipo de documento"
          value={typeFilter}
          onChange={setTypeFilter}
          rows={types}
          id="id"
          empty="Todos los tipos cargados"
        />
      </div>
      <MutationNotice message={mutation.message} />
      {editing && !unlink && (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Field label="Nombre del documento">
              <TextField
                required
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Enlace del documento">
              <TextField
                required
                type="url"
                maxLength={4000}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={Boolean(editing.id)}
                className={fieldClass}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                label="Proveedor del documento"
                value={provider}
                onChange={setProvider}
                rows={providers}
                id="id"
                disabled={Boolean(editing.id)}
                empty="Selecciona proveedor"
              />
              <Choice
                label="Formato del documento"
                value={docType}
                onChange={setDocType}
                rows={types}
                id="id"
                empty="Selecciona formato"
              />
            </div>
            <p className="text-xs text-secondary">
              Se guarda una referencia al original. Su proveedor administra el
              acceso al contenido.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                type="submit"
                disabled={
                  mutation.busy || !safeWebUrl(url) || !provider || !docType
                }
              >
                Guardar documento
              </Button>
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setEditing(null)}
              >
                Cancelar documento
              </Button>
            </div>
          </form>
        </Card>
      )}
      {list.state.loading ? (
        <p role="status" className="text-sm text-secondary">
          Cargando documentos…
        </p>
      ) : (
        <>
          {list.state.error && (
            <p role="alert" className="text-sm text-danger">
              {list.state.error}
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {(list.state.data || [])
              .filter((row) => !typeFilter || row.doc_type === typeFilter)
              .map((row) => (
                <Card key={text(row.id)}>
                  <h4 className="text-sm font-semibold">{text(row.name)}</h4>
                  <p className="mt-2 text-xs text-secondary">
                    {types.find((type) => type.id === row.doc_type)?.name ||
                      "Documento"}{" "}
                    ·{" "}
                    {providers.find((provider) => provider.id === row.provider)
                      ?.name || "Enlace"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        !onOpenWeb || !safeWebUrl(text(row.external_url))
                      }
                      onClick={() => {
                        const valid = safeWebUrl(text(row.external_url));
                        if (valid) onOpenWeb?.(valid);
                      }}
                    >
                      Abrir documento
                    </Button>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => edit(row)}
                      >
                        Editar documento
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(row);
                          setUnlink(true);
                        }}
                      >
                        Desvincular documento
                      </Button>
                    )}
                  </div>
                  {unlink && editing?.id === row.id && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs text-secondary">
                        Se quitará la referencia de este proyecto. El archivo
                        original permanecerá en su proveedor.
                      </p>
                      <Button
                        size="sm"
                        disabled={mutation.busy}
                        onClick={() =>
                          void mutation.run(
                            () => remove(row),
                            () => {
                              setEditing(null);
                              setUnlink(false);
                              refresh();
                            },
                          )
                        }
                      >
                        Confirmar desvinculación
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setUnlink(false);
                          setEditing(null);
                        }}
                      >
                        Conservar documento
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
          </div>
          {list.state.data?.length === 0 && (
            <Card>
              <p className="text-sm text-secondary">
                No hay documentos vinculados con esta búsqueda.
              </p>
            </Card>
          )}
          <MoreButton
            hasMore={list.hasMore}
            loading={list.moreLoading}
            onMore={() => void list.more()}
          />
        </>
      )}
    </section>
  );
}
