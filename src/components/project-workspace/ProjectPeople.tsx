import { Choice } from "./ManagementControls";
import { useProjectMutation } from "./management-state";
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
  directory = [],
}: {
  workspaceId: string;
  projectId: string;
  state: DataState<DataRecord[]>;
  canManage: boolean;
  onRefresh: () => void;
  directory?: DataRecord[];
}) {
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const mutation = useProjectMutation();
  const busy = mutation.busy,
    error = mutation.message;
  const [removing, setRemoving] = useState<string | null>(null);
  const updateRole = async (id: string, value: string) => {
    const role = projectHubRole.safeParse(value);
    if (!canManage || !role.success || role.data === "owner") return;
    await mutation.run(
      () => projectHubApi.updateMember(workspaceId, projectId, id, role.data),
      onRefresh,
    );
  };
  const remove = async (id: string) => {
    if (!canManage) return;
    await mutation.run(
      () => projectHubApi.removeMember(workspaceId, projectId, id),
      () => {
        setRemoving(null);
        onRefresh();
      },
    );
  };
  const add = async () => {
    if (!canManage || !directory.some((person) => person.user_id === userId))
      return;
    await mutation.run(
      () => projectHubApi.addMember(workspaceId, projectId, userId, "member"),
      () => {
        setAdding(false);
        setUserId("");
        onRefresh();
      },
    );
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Colaboradores del proyecto</h2>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(!adding)}>
            Añadir colaborador
          </Button>
        )}
      </div>
      <p className="text-xs text-secondary">
        La conexión actual permite añadir miembros existentes del espacio de
        trabajo. Los permisos del equipo y de los proveedores de archivos se
        administran por separado.
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
            <Choice
              label="Colaborador del espacio"
              value={userId}
              onChange={setUserId}
              rows={directory.filter(
                (person) =>
                  !state.data?.some(
                    (member) =>
                      relation(member.user).user_id === person.user_id,
                  ),
              )}
              id="user_id"
              empty="Selecciona una persona"
            />
            <p className="text-xs text-secondary">
              Se concederá el rol Miembro en este proyecto. No se conceden
              permisos de archivos del proveedor.
            </p>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={busy} disabled={!userId}>
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
                    <div className="block text-xs text-secondary">
                      <Choice
                        label={"Rol de " + name}
                        value={text(member.project_role)}
                        onChange={(value) => void updateRole(id, value)}
                        rows={["admin", "member", "viewer", "guest"].map(
                          (role) => ({ id: role, name: roleLabels[role] }),
                        )}
                        id="id"
                        disabled={busy}
                        empty="Selecciona un rol"
                      />
                    </div>
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
