import { useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { dateLabel, text, type DataRecord } from "./dashboard-data";
import {
  Choice,
  Field,
  fieldClass,
  MoreButton,
  MutationNotice,
} from "./ManagementControls";
import { useProjectMutation } from "./management-state";
import { useProjectCollection } from "./useProjectCollection";

const statuses = [
  { id: "pending", name: "Pendiente" },
  { id: "in_progress", name: "En curso" },
  { id: "completed", name: "Completado" },
  { id: "missed", name: "Incumplido" },
  { id: "cancelled", name: "Cancelado" },
];
export function ProjectMilestones({
  workspaceId,
  projectId,
  canWrite,
  onRefresh,
}: {
  workspaceId: string;
  projectId: string;
  canWrite: boolean;
  onRefresh: () => void;
}) {
  const target = { workspaceId, projectId };
  const [search, setSearch] = useState("");
  const list = useProjectCollection(
    JSON.stringify([workspaceId, projectId, search]),
    (cursor) =>
      projectHubApi.listMilestones({
        ...target,
        search: search || undefined,
        cursor,
      }),
    "milestone_id",
  );
  const [editing, setEditing] = useState<DataRecord | null>(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [date, setDate] = useState(""),
    [status, setStatus] = useState("pending"),
    [order, setOrder] = useState("0"),
    [cancel, setCancel] = useState(false);
  const mutation = useProjectMutation();
  const refresh = () => {
    list.reload();
    onRefresh();
  };
  const edit = (row: DataRecord) => {
    setEditing(row);
    setName(text(row.milestone_name));
    setDescription(text(row.milestone_description));
    setDate(text(row.target_date));
    setStatus(text(row.milestone_status, "pending"));
    setOrder(String(row.sort_order || 0));
    setCancel(false);
  };
  const save = () => {
    const milestone = {
      name: name.trim(),
      description: description || null,
      target_date: date,
      status: status as
        | "pending"
        | "in_progress"
        | "completed"
        | "missed"
        | "cancelled",
      sort_order: Number(order),
    };
    void mutation.run(
      () =>
        editing?.milestone_id
          ? projectHubApi.updateMilestone({
              ...target,
              milestoneId: text(editing.milestone_id),
              updates: milestone,
              expectedUpdatedAt: text(editing.updated_at) || undefined,
            })
          : projectHubApi.createMilestone({ ...target, milestone }),
      () => {
        setEditing(null);
        refresh();
      },
    );
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Hitos</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(null);
              refresh();
            }}
          >
            Actualizar hitos
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => edit({})}>
              Nuevo hito
            </Button>
          )}
        </div>
      </div>
      <Field label="Buscar hitos">
        <TextField
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={fieldClass}
        />
      </Field>
      <MutationNotice message={mutation.message} />
      {editing && (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (canWrite) save();
            }}
          >
            <h3 className="font-semibold">Detalle del hito</h3>
            <Field label="Nombre del hito">
              <TextField
                required
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={fieldClass}
                disabled={!canWrite}
              />
            </Field>
            <Field label="Descripción del hito">
              <textarea
                value={description}
                maxLength={20000}
                onChange={(event) => setDescription(event.target.value)}
                className={fieldClass}
                rows={3}
                disabled={!canWrite}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fecha objetivo">
                <TextField
                  required
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={fieldClass}
                  disabled={!canWrite}
                />
              </Field>
              <Choice
                label="Estado del hito"
                value={status}
                onChange={setStatus}
                rows={statuses}
                id="id"
                disabled={!canWrite}
                empty="Selecciona un estado"
              />
              <Field label="Orden de presentación">
                <TextField
                  type="number"
                  required
                  min={0}
                  max={1000000}
                  step={1}
                  value={order}
                  onChange={(event) => setOrder(event.target.value)}
                  className={fieldClass}
                  disabled={!canWrite}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {canWrite && (
                <Button
                  size="sm"
                  type="submit"
                  disabled={mutation.busy || !status}
                >
                  Guardar hito
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cerrar hito
              </Button>
              {canWrite &&
                Boolean(editing.milestone_id) &&
                status !== "cancelled" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mutation.busy}
                    onClick={() => setCancel(true)}
                  >
                    Cancelar hito
                  </Button>
                )}
            </div>
          </form>
          {cancel && (
            <div className="mt-4">
              <p className="mb-2 text-sm">
                El hito conservará su historial y quedará cancelado.
              </p>
              <Button
                size="sm"
                disabled={mutation.busy}
                onClick={() =>
                  void mutation.run(
                    () =>
                      projectHubApi.cancelMilestone({
                        ...target,
                        milestoneId: text(editing.milestone_id),
                        expectedUpdatedAt:
                          text(editing.updated_at) || undefined,
                      }),
                    () => {
                      setEditing(null);
                      refresh();
                    },
                  )
                }
              >
                Confirmar cancelación del hito
              </Button>
            </div>
          )}
        </Card>
      )}
      {list.state.loading ? (
        <p role="status" className="text-sm text-secondary">
          Cargando hitos…
        </p>
      ) : (
        <>
          {list.state.error && (
            <p role="alert" className="text-sm text-danger">
              {list.state.error}
            </p>
          )}
          {list.state.data?.length === 0 ? (
            <Card>
              <p className="text-sm text-secondary">
                No hay hitos visibles con estos filtros.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {[...(list.state.data || [])]
                .sort(
                  (a, b) =>
                    Number(a.sort_order || 0) - Number(b.sort_order || 0),
                )
                .map((row) => (
                  <Card key={text(row.milestone_id)}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold">
                        {text(row.milestone_name)}
                      </h3>
                      <span className="rounded-full bg-surface-2 px-3 py-1 text-xs">
                        {statuses.find(
                          (status) => status.id === row.milestone_status,
                        )?.name || "Sin estado"}
                      </span>
                    </div>
                    <p className="my-3 whitespace-pre-wrap text-sm text-secondary">
                      {text(row.milestone_description)}
                    </p>
                    <p className="mb-3 text-xs text-secondary">
                      Objetivo: {dateLabel(row.target_date)}
                      {row.completed_date
                        ? " · Completado: " + dateLabel(row.completed_date)
                        : ""}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => edit(row)}>
                      Ver hito
                    </Button>
                  </Card>
                ))}
            </div>
          )}
          <MoreButton
            hasMore={list.hasMore}
            loading={list.moreLoading}
            onMore={() => void list.more()}
          />
        </>
      )}
    </div>
  );
}
