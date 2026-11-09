import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ProjectOverview } from "../project-workspace/ProjectOverview";
import { ProjectResources } from "../project-workspace/ProjectResources";
import { ProjectTasks } from "../project-workspace/ProjectTasks";
import { ProjectPeople } from "../project-workspace/ProjectPeople";
import {
  PROJECT_SECTIONS,
  type ProjectNavigation,
  type ProjectSection,
} from "../project-workspace/types";
import {
  count,
  dateLabel,
  projectProgress,
  projectStatus,
  record,
  text,
} from "../project-workspace/dashboard-data";
import { useProjectDashboard } from "../project-workspace/useProjectDashboard";
import type { ProjectHubProject } from "../../services/project-hub-api";

interface Props {
  workspaceId: string;
  projectId: string;
  section?: ProjectSection;
  navigation?: ProjectNavigation;
  onNavigate?: (section: ProjectSection) => void;
  onProjectReady?: (project: ProjectHubProject) => void;
  onOpenWeb?: (url: string) => void;
}
export function UnifiedProjectHub(props: Props) {
  return (
    <ProjectDashboard
      key={props.workspaceId + "/" + props.projectId}
      {...props}
    />
  );
}
function ProjectDashboard(props: Props) {
  const data = useProjectDashboard(props.workspaceId, props.projectId);
  const [internalSection, setInternalSection] =
    useState<ProjectSection>("summary");
  const section = props.section ?? internalSection;
  const navigate = props.onNavigate ?? setInternalSection;
  const project = data.project.data;
  const notify = props.onProjectReady;
  useEffect(() => {
    if (project) notify?.(project);
  }, [project, notify]);
  if (data.project.loading)
    return (
      <div
        role="status"
        className="grid h-full place-items-center text-sm text-secondary"
      >
        Cargando proyecto…
      </div>
    );
  if (!project)
    return (
      <div className="grid h-full place-items-center">
        <Card>
          <p className="text-sm text-secondary">{data.project.error}</p>
          <Button size="sm" className="mt-3 !rounded-2xl" onClick={data.reload}>
            Reintentar proyecto
          </Button>
        </Card>
      </div>
    );
  const role = project.role ?? project.membership?.project_role;
  const manage = role === "owner" || role === "admin";
  const write = manage || role === "member";
  const progress = projectProgress(data.analytics.data);
  return (
    <div className="project-workspace flex h-full min-h-0 min-w-0 flex-1 text-primary">
      {!props.onNavigate && (
        <nav
          aria-label="Apartados del proyecto"
          className="w-44 shrink-0 overflow-y-auto p-3"
        >
          {PROJECT_SECTIONS.map((item) => (
            <button
              type="button"
              key={item.id}
              className="project-nav-button"
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      <div className="min-w-0 flex-1 overflow-y-auto custom-scrollbar p-4 md:p-7">
        <header className="mb-6">
          <p className="mb-3 text-xs text-secondary">
            Proyectos / {project.project_key}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="break-words text-2xl font-semibold tracking-tight md:text-3xl">
                  {project.project_name}
                </h1>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">
                  {projectStatus(project.project_status)}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-secondary">
                {project.project_description || "Sin descripción todavía."}
              </p>
              <p className="mt-3 text-xs text-secondary">
                Objetivo: {dateLabel(project.target_date)} · Actualizado:{" "}
                {dateLabel(project.updated_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate("teams")}
              >
                {manage ? "Añadir colaborador" : "Colaboradores"}
              </Button>
              {write && (
                <Button size="sm" onClick={() => navigate("tasks")}>
                  Añadir tarea
                </Button>
              )}
            </div>
          </div>
        </header>
        {section === "summary" && (
          <ProjectOverview
            project={project}
            data={data}
            chatsCount={props.navigation?.conversations.length ?? 0}
            onNavigate={navigate}
          />
        )}
        {section === "tasks" && (
          <ProjectTasks
            workspaceId={props.workspaceId}
            projectId={props.projectId}
            state={data.tasks}
            canWrite={write}
            onRefresh={data.reload}
          />
        )}
        {(section === "files" || section === "web") && (
          <ProjectResources
            key={section}
            workspaceId={props.workspaceId}
            projectId={props.projectId}
            kind={section}
            state={data.evidence}
            canWrite={write}
            onRefresh={data.reload}
            onOpenWeb={props.onOpenWeb}
          />
        )}
        {section === "teams" && (
          <ProjectPeople
            workspaceId={props.workspaceId}
            projectId={props.projectId}
            state={data.members}
            canManage={manage}
            onRefresh={data.reload}
          />
        )}
        {section === "chats" && (
          <Card>
            <h2 className="text-lg font-semibold">Chats del proyecto</h2>
            <p className="my-3 text-xs text-secondary">
              {props.navigation?.chatMessage ||
                "Las conversaciones permanecen en este proyecto. Su visibilidad depende de los permisos del espacio de chats."}
            </p>
            {props.navigation?.canCreateChat && (
              <Button size="sm" onClick={props.navigation.onNewChat}>
                Nuevo chat
              </Button>
            )}
            <div className="mt-4 space-y-1">
              {props.navigation?.conversations.map((chat) => (
                <button
                  type="button"
                  key={chat.id}
                  className="project-nav-button text-primary"
                  onClick={() => props.navigation?.onOpenChat(chat.id)}
                >
                  {chat.title}
                </button>
              ))}
            </div>
          </Card>
        )}
        {(section === "milestones" || section === "cycles") && (
          <Card>
            <h2 className="text-lg font-semibold">
              {section === "milestones" ? "Hitos" : "Ciclos de trabajo"}
            </h2>
            <p className="mt-3 text-sm text-secondary">
              La conexión actual todavía no proporciona{" "}
              {section === "milestones" ? "los hitos" : "los ciclos"} del
              proyecto. Este estado no significa que el proyecto esté vacío.
            </p>
          </Card>
        )}
        {section === "metrics" && (
          <Card>
            <h2 className="text-lg font-semibold">Métricas del proyecto</h2>
            {data.analytics.loading ? (
              <p className="mt-3 text-sm text-secondary">Cargando métricas…</p>
            ) : data.analytics.error ? (
              <>
                <p className="mt-3 text-sm text-secondary">
                  {data.analytics.error}
                </p>
                <Button size="sm" onClick={data.reload}>
                  Reintentar
                </Button>
              </>
            ) : (
              <>
                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  {[
                    [
                      "Avance",
                      progress
                        ? progress.percent === null
                          ? "Sin tareas"
                          : progress.percent + " %"
                        : "Sin datos",
                    ],
                    [
                      "Tareas",
                      count(record(data.analytics.data?.tasks).total) ??
                        "Sin datos",
                    ],
                    [
                      "Vencidas",
                      count(record(data.analytics.data?.tasks).overdue) ??
                        "Sin datos",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-secondary">{label}</dt>
                      <dd className="mt-2 text-2xl font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-5 text-xs text-secondary">
                  Corte actual de la API. Avance: completadas / total informado.
                  Las tendencias históricas requieren historial de cambios; no
                  se infieren de esta instantánea.
                </p>
              </>
            )}
          </Card>
        )}
        {section === "activity" && (
          <Card>
            <h2 className="text-lg font-semibold">Actividad reciente</h2>
            {data.analytics.loading ? (
              <p className="mt-3 text-sm text-secondary">Cargando actividad…</p>
            ) : data.analytics.error ? (
              <p className="mt-3 text-sm text-secondary">
                {data.analytics.error}
              </p>
            ) : (
              <div className="mt-3 divide-y divide-border">
                {Array.isArray(data.analytics.data?.recent_activity) &&
                data.analytics.data.recent_activity.length ? (
                  data.analytics.data.recent_activity.map((item, index) => {
                    const row = record(item);
                    const labels: Record<string, string> = {
                      "project.created": "Proyecto creado",
                      "project.updated": "Proyecto actualizado",
                      "task.created": "Tarea creada",
                      "member.added": "Colaborador añadido",
                    };
                    return (
                      <div
                        key={text(row.activity_id, String(index))}
                        className="py-3 text-sm"
                      >
                        <p>
                          {labels[text(row.action)] ||
                            "Actualización del proyecto"}
                        </p>
                        <p className="mt-1 text-xs text-secondary">
                          {dateLabel(row.created_at)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-3 text-sm text-secondary">
                    No hay actividad disponible.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
