import { useEffect, useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import type { ProjectHubProject } from "../../services/project-hub-api";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import {
  record,
  relation,
  text,
  type DataRecord,
  type DataState,
} from "./dashboard-data";
import { Choice, Field, fieldClass, MutationNotice } from "./ManagementControls";
import { rows, userRows, useProjectMutation } from "./management-state";
import { ProjectPeople } from "./ProjectPeople";

const roles = [
  { id: "admin", name: "Administrador" },
  { id: "moderator", name: "Moderador" },
  { id: "member", name: "Miembro" },
  { id: "viewer", name: "Lector" },
];
const visibilityRows = [
  { id: "private", name: "Privado" },
  { id: "internal", name: "Interno" },
  { id: "public", name: "Público" },
];
export function ProjectTeam({
  workspaceId,
  projectId,
  project,
  members,
  canManage,
  onRefresh,
}: {
  workspaceId: string;
  projectId: string;
  project: ProjectHubProject;
  members: DataState<DataRecord[]>;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const target = { workspaceId, projectId };
  const [revision, setRevision] = useState(0),
    [state, setState] = useState<{
      loading: boolean;
      data: DataRecord;
      error?: string;
    }>({ loading: true, data: {} });
  const [teamId, setTeamId] = useState(""),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [visibility, setVisibility] = useState("private"),
    [user, setUser] = useState(""),
    [role, setRole] = useState("member"),
    [removing, setRemoving] = useState("");
  const mutation = useProjectMutation();
  useEffect(() => {
    let active = true;
    void projectHubApi
      .getProjectTeam({ workspaceId, projectId })
      .then((result) => {
        if (active)
          setState({
            loading: false,
            data: record(result.data),
            error: result.success
              ? undefined
              : result.error || "No se pudo consultar el equipo.",
          });
      })
      .catch(() => {
        if (active)
          setState({
            loading: false,
            data: {},
            error: "No se pudo consultar el equipo.",
          });
      });
    return () => {
      active = false;
    };
  }, [workspaceId, projectId, revision]);
  const refresh = () => {
    setRevision((value) => value + 1);
    onRefresh();
  };
  const team = record(state.data.team),
    teamMembers = rows(state.data.members),
    directory = userRows(state.data.directory),
    canEdit = state.data.can_manage === true;
  const startEdit = (create: boolean) => {
    setCreating(create);
    setEditing(!create);
    setName(create ? "" : text(team.name));
    setDescription(create ? "" : text(team.description));
    setVisibility(create ? "private" : text(team.visibility, "private"));
  };
  const save = () => {
    const fields = {
      name: name.trim(),
      description: description || null,
      visibility: visibility as "private" | "public" | "internal",
    };
    void mutation.run(
      () =>
        creating
          ? projectHubApi.createProjectTeam({ ...target, team: fields })
          : projectHubApi.updateProjectTeam({
              ...target,
              teamId: text(team.team_id),
              updates: fields,
              expectedUpdatedAt: text(team.updated_at) || undefined,
            }),
      () => {
        setCreating(false);
        setEditing(false);
        refresh();
      },
    );
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Equipo del proyecto</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setCreating(false);
            setEditing(false);
            refresh();
          }}
        >
          Actualizar equipo
        </Button>
      </div>
      <MutationNotice message={mutation.message} />
      {state.loading ? (
        <p role="status" className="text-sm text-secondary">
          Cargando equipo…
        </p>
      ) : state.error ? (
        <Card>
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        </Card>
      ) : (
        <>
          {state.data.restricted === true ? (
            <Card>
              <p className="text-sm text-secondary">
                Este proyecto tiene un equipo privado. Necesitas acceso al
                equipo para consultar sus integrantes.
              </p>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {text(team.name, "Sin equipo asignado")}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
                    {text(team.description)}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => startEdit(false)}
                  >
                    Editar equipo
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-secondary">
                El proyecto tiene un equipo principal. Incorporar a alguien al
                equipo y compartirle este proyecto son permisos independientes.
              </p>
            </Card>
          )}
          {canManage && state.data.can_assign === true && (
            <Card>
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice
                  label="Equipo principal"
                  value={teamId}
                  onChange={setTeamId}
                  rows={rows(state.data.available)}
                  id="team_id"
                  empty="Selecciona un equipo"
                />
                <div className="flex items-end gap-2">
                  <Button
                    size="sm"
                    disabled={!teamId || mutation.busy}
                    onClick={() =>
                      void mutation.run(
                        () =>
                          projectHubApi.assignProjectTeam({
                            ...target,
                            teamId,
                            expectedUpdatedAt: project.updated_at,
                          }),
                        refresh,
                      )
                    }
                  >
                    Asignar equipo
                  </Button>
                  {state.data.can_create === true && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(true)}
                    >
                      Crear equipo
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-secondary">
                Un proyecto que ya tiene tareas requiere una migración para
                cambiar de equipo.
              </p>
            </Card>
          )}
          {(creating || editing) && (
            <Card>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  save();
                }}
              >
                <h3 className="font-semibold">
                  {creating ? "Nuevo equipo" : "Editar equipo"}
                </h3>
                <Field label="Nombre del equipo">
                  <TextField
                    required
                    maxLength={255}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Descripción del equipo">
                  <textarea
                    maxLength={20000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className={fieldClass}
                  />
                </Field>
                <Choice
                  label="Visibilidad del equipo"
                  value={visibility}
                  onChange={setVisibility}
                  rows={visibilityRows}
                  id="id"
                  empty="Selecciona visibilidad"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    type="submit"
                    disabled={mutation.busy || !visibility}
                  >
                    Guardar equipo
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCreating(false);
                      setEditing(false);
                    }}
                  >
                    Cancelar edición
                  </Button>
                </div>
                <p className="text-xs text-secondary">
                  Los cambios del equipo se reflejan en todos los proyectos que
                  lo utilizan. Al crear un equipo, después podrás asignarlo
                  aquí.
                </p>
              </form>
            </Card>
          )}
          {team.team_id && (
            <Card>
              <h3 className="mb-3 font-semibold">Integrantes del equipo</h3>
              {canEdit && (
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <Choice
                    label="Nuevo integrante"
                    value={user}
                    onChange={setUser}
                    rows={directory.filter(
                      (person) =>
                        !teamMembers.some(
                          (member) => member.user_id === person.user_id,
                        ),
                    )}
                    id="user_id"
                    empty="Selecciona una persona"
                  />
                  <Choice
                    label="Rol del nuevo integrante"
                    value={role}
                    onChange={setRole}
                    rows={roles}
                    id="id"
                    empty="Selecciona un rol"
                  />
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      disabled={!user || !role || mutation.busy}
                      onClick={() =>
                        void mutation.run(
                          () =>
                            projectHubApi.addTeamMember({
                              ...target,
                              teamId: text(team.team_id),
                              userId: user,
                              role: role as
                                | "admin"
                                | "moderator"
                                | "member"
                                | "viewer",
                            }),
                          () => {
                            setUser("");
                            refresh();
                          },
                        )
                      }
                    >
                      Añadir al equipo
                    </Button>
                  </div>
                </div>
              )}
              <div className="divide-y divide-border">
                {teamMembers.map((member) => (
                  <div
                    key={text(member.member_id)}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {text(
                          relation(member.user).display_name,
                          text(relation(member.user).email, "Integrante"),
                        )}
                      </p>
                      <p className="mt-1 text-xs text-secondary">
                        {text(relation(member.user).email)}
                      </p>
                    </div>
                    {canEdit &&
                    member.role !== "owner" &&
                    member.user_id !== team.owner_id ? (
                      <div className="flex items-center gap-2">
                        <Choice
                          label={
                            "Rol de " +
                            text(
                              relation(member.user).display_name,
                              "integrante",
                            )
                          }
                          value={text(member.role)}
                          onChange={(next) => {
                            if (next)
                              void mutation.run(
                                () =>
                                  projectHubApi.updateTeamMember({
                                    ...target,
                                    teamId: text(team.team_id),
                                    memberId: text(member.member_id),
                                    role: next as
                                      | "admin"
                                      | "moderator"
                                      | "member"
                                      | "viewer",
                                  }),
                                refresh,
                              );
                          }}
                          rows={roles}
                          id="id"
                          disabled={mutation.busy}
                          empty="Selecciona rol"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={mutation.busy}
                          onClick={() => setRemoving(text(member.member_id))}
                        >
                          Retirar del equipo
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-secondary">
                        {member.role === "owner"
                          ? "Propietario"
                          : roles.find((role) => role.id === member.role)
                              ?.name || "Miembro"}
                      </span>
                    )}
                    {removing === member.member_id && (
                      <div className="w-full">
                        <p className="mb-2 text-sm">
                          Se retirará su acceso al equipo y a sus otros recursos
                          asociados.
                        </p>
                        <Button
                          size="sm"
                          disabled={mutation.busy}
                          onClick={() =>
                            void mutation.run(
                              () =>
                                projectHubApi.removeTeamMember({
                                  ...target,
                                  teamId: text(team.team_id),
                                  memberId: text(member.member_id),
                                }),
                              () => {
                                setRemoving("");
                                refresh();
                              },
                            )
                          }
                        >
                          Confirmar retiro del equipo
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRemoving("")}
                        >
                          Conservar integrante
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
      <ProjectPeople
        workspaceId={workspaceId}
        projectId={projectId}
        state={members}
        canManage={canManage}
        onRefresh={refresh}
        directory={directory}
      />
    </div>
  );
}
