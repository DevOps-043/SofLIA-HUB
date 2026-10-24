import { TextField } from "../ui/TextField";
import { useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import { projectHubRole } from "../../shared/project-hub";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import {
  relation,
  text,
  type DataRecord,
  type DataState,
} from "./dashboard-data";

const roleLabels: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
  viewer: "Lector",
  guest: "Invitado",
};
export function ProjectPeople({
  workspaceId,
  projectId,
  state,
  canManage,
  onRefresh,
}: {
  workspaceId: string;
  projectId: string;
  state: DataState<DataRecord[]>;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const updateRole = async (id: string, value: string) => {
    const role = projectHubRole.safeParse(value);
    if (!canManage || busy || !role.success || role.data === "owner") return;
    setBusy(true);
    setError("");
    try {
      const result = await projectHubApi.updateMember(
        workspaceId,
        projectId,
        id,
        role.data,
      );
      if (result.success) onRefresh();
      else setError(result.error || "No se pudo actualizar el rol.");
    } catch {
      setError("No se pudo actualizar el rol.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (!canManage || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await projectHubApi.removeMember(
        workspaceId,
        projectId,
        id,
      );
      if (result.success) {
        setRemoving(null);
        onRefresh();
      } else setError(result.error || "No se pudo retirar al colaborador.");
    } catch {
      setError("No se pudo retirar al colaborador.");
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    if (!canManage || busy) return;
    if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(userId)) {
      setError(
        "Introduce el identificador válido de un miembro del espacio de trabajo.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await projectHubApi.addMember(
        workspaceId,
        projectId,
        userId,
        "member",
      );
      if (!result.success)
        setError(result.error || "No se pudo añadir al colaborador.");
      else {
        setAdding(false);
        setUserId("");
        onRefresh();
      }
    } catch {
      setError("No se pudo añadir al colaborador.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Equipos y colaboradores</h2>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(!adding)}>
            Añadir colaborador
          </Button>
        )}
      </div>
      <p className="text-xs text-secondary">
        La conexión actual permite añadir miembros existentes del espacio de
        trabajo. Las invitaciones por correo y el detalle de equipos requieren
        ampliar el contrato.
      </p>
      {adding && (
        <Card>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <label className="block text-sm">
              Identificador del miembro
              <TextField
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value.trim())}
                className="mt-2 w-full rounded-2xl border border-border bg-surface-2 p-3 text-sm"
              />
            </label>
            <p className="text-xs text-secondary">
              Se concederá el rol Miembro en este proyecto. No se conceden
              permisos de archivos del proveedor.
            </p>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={busy}>
                Confirmar incorporación
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {state.loading ? (
        <p className="text-sm text-secondary">Cargando colaboradores…</p>
      ) : state.error ? (
        <Card>
          <p className="text-sm text-secondary">{state.error}</p>
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            Reintentar
          </Button>
        </Card>
      ) : state.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {state.data.map((member) => {
            const user = relation(member.user);
            const name = text(user.display_name, text(user.email, "Usuario"));
            const id = text(member.member_id);
            return (
              <Card key={id}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                    {name.slice(0, 2).toLocaleUpperCase("es")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="mt-1 text-xs text-secondary">
                      {roleLabels[text(member.project_role)] ||
                        "Sin rol disponible"}
                    </p>
                  </div>
                </div>
                {canManage && member.project_role !== "owner" && (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs text-secondary">
                      Rol de {name}
                      <select
                        aria-label={`Rol de ${name}`}
                        disabled={busy}
                        value={text(member.project_role)}
                        onChange={(event) =>
                          void updateRole(id, event.target.value)
                        }
                        className="ml-2 rounded-2xl border border-border bg-surface-2 px-3 py-2 text-primary"
                      >
                        {["admin", "member", "viewer", "guest"].map((role) => (
                          <option key={role} value={role}>
                            {roleLabels[role]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {removing === id ? (
                      <div>
                        <p className="mb-2 text-xs text-secondary">
                          Retirar a {name} bloquea su acceso futuro al proyecto;
                          no borra copias ni permisos externos.
                        </p>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => void remove(id)}
                        >
                          Confirmar retirada
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRemoving(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoving(id)}
                      >
                        Retirar del proyecto
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-secondary">
            No hay colaboradores visibles.
          </p>
        </Card>
      )}
      {state.partial && (
        <p className="text-xs text-secondary">
          Se muestra una página de colaboradores.
        </p>
      )}
    </div>
  );
}
