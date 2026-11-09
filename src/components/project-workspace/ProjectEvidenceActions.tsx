import { useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { text, type DataRecord } from "./dashboard-data";
import { Field, fieldClass, MutationNotice } from "./ManagementControls";
import { useProjectMutation } from "./management-state";

export function ProjectEvidenceActions({
  workspaceId,
  projectId,
  row,
  canWrite,
  canManage,
  onRefresh,
}: {
  workspaceId: string;
  projectId: string;
  row: DataRecord;
  canWrite: boolean;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [removing, setRemoving] = useState(false),
    [title, setTitle] = useState(text(row.title)),
    [summary, setSummary] = useState(text(row.summary));
  const mutation = useProjectMutation();
  const target = { workspaceId, projectId, evidenceId: text(row.evidence_id) };
  return (
    <div className="mt-3 space-y-3">
      <MutationNotice message={mutation.message} />
      <div className="flex flex-wrap gap-2">
        {canWrite && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTitle(text(row.title));
              setSummary(text(row.summary));
              setEditing(true);
            }}
          >
            Editar archivo
          </Button>
        )}
        {canManage && (
          <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
            Retirar archivo
          </Button>
        )}
      </div>
      {editing && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void mutation.run(
              () =>
                projectHubApi.updateEvidence({
                  ...target,
                  updates: {
                    title: title.trim(),
                    summary: summary || null,
                    expected_title: text(row.title),
                    expected_summary:
                      typeof row.summary === "string" ? row.summary : null,
                  },
                }),
              () => {
                setEditing(false);
                onRefresh();
              },
            );
          }}
        >
          <Field label="Título del archivo">
            <TextField
              required
              maxLength={500}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Resumen del archivo">
            <textarea
              maxLength={20000}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Button type="submit" size="sm" disabled={mutation.busy}>
            Guardar datos del archivo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            Cancelar edición del archivo
          </Button>
        </form>
      )}
      {removing && (
        <div>
          <p className="mb-2 text-xs text-secondary">
            Se archivará este recurso en el proyecto. El contenido original y
            las copias existentes permanecerán guardados.
          </p>
          <Button
            size="sm"
            disabled={mutation.busy}
            onClick={() =>
              void mutation.run(
                () => projectHubApi.archiveEvidence(target),
                () => {
                  setRemoving(false);
                  onRefresh();
                },
              )
            }
          >
            Confirmar retiro del archivo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRemoving(false)}>
            Conservar archivo
          </Button>
        </div>
      )}
    </div>
  );
}
