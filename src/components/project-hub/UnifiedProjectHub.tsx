import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ProjectOverview } from "../project-workspace/ProjectOverview";
import { ProjectFiles } from "../project-workspace/ProjectFiles";
import { ProjectMilestones } from "../project-workspace/ProjectMilestones";
import { ProjectTasks } from "../project-workspace/ProjectTasks";
import { ProjectTeam } from "../project-workspace/ProjectTeam";
import { ProjectGlyph } from '../project-workspace/ProjectGlyph';
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
      <div className={`project-dashboard-content ${section === 'tasks' ? 'is-tasks-view' : ''} min-w-0 flex-1 overflow-y-auto custom-scrollbar p-4 md:p-7`}>
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
            onOpenWeb={props.onOpenWeb}
            state={data.tasks}
            canWrite={write}
            canManage={manage}
            onRefresh={data.reload}
          />
        )}
        {(section === "files" || section === "web") && (
          <ProjectFiles
            key={section}
            workspaceId={props.workspaceId}
            projectId={props.projectId}
            kind={section}
            onOpenBrowser={props.navigation?.onOpenBrowser}
            canWrite={write}
            canManage={manage}
            onRefresh={data.reload}
            onOpenWeb={props.onOpenWeb}
          />
        )}
        {section === "teams" && (
          <ProjectTeam
            workspaceId={props.workspaceId}
            projectId={props.projectId}
            project={project}
            members={data.members}
            canManage={manage}
            onRefresh={data.reload}
          />
        )}
        {section === "chats" && (
          <section aria-label="Conversaciones del proyecto">
            <div className="project-resource-heading"><div><h2>Chats del proyecto</h2><p>Continúa una conversación o empieza una nueva.</p></div><div className="project-resource-actions">
              {props.navigation && <Button size="sm" disabled={!props.navigation.canCreateChat} onClick={props.navigation.onNewChat}>Nuevo chat</Button>}
              {props.navigation?.onRetryChats && <Button size="sm" variant="ghost" onClick={props.navigation.onRetryChats}>Actualizar chats</Button>}
            </div></div>
            <p className="my-3 text-xs text-secondary">
              {props.navigation?.chatMessage}
            </p>
            <div className="project-chat-list">
              {props.navigation?.conversations.map((chat) => (
                <button
                  type="button"
                  key={chat.id}
                  onClick={() => props.navigation?.onOpenChat(chat.id)}
                >
                  <ProjectGlyph name="chats" /><span>{chat.title}<small>Actualizado {dateLabel(chat.updated_at)}</small></span>
                </button>
              ))}
            </div>
            {!props.navigation?.chatMessage && !props.navigation?.conversations.length && <div className="project-resource-empty"><ProjectGlyph name="chats" size={34} /><h3>Tu primera conversación del proyecto</h3><p>Usa Nuevo chat para empezar a trabajar con Soflia aquí.</p></div>}
          </section>
        )}
        {section === "milestones" && (
          <ProjectMilestones
            workspaceId={props.workspaceId}
            projectId={props.projectId}
            canWrite={write}
            onRefresh={data.reload}
          />
        )}
        {section === "cycles" && (
          <Card>
            <h2 className="text-lg font-semibold">
              Ciclos de trabajo del equipo
            </h2>
            <p className="my-3 text-xs text-secondary">
              Los ciclos pertenecen al equipo principal. Asigna las tareas del
              proyecto desde su detalle.
            </p>
            {data.options.loading ? (
              <p>Cargando ciclos…</p>
            ) : data.options.error ? (
              <p role="alert">{data.options.error}</p>
            ) : Array.isArray(data.options.data?.cycles) &&
              data.options.data.cycles.length ? (
              data.options.data.cycles.map((item) => {
                const cycle = record(item);
                return (
                  <div
                    key={text(cycle.cycle_id)}
                    className="border-b border-border py-3"
                  >
                    <h3 className="font-medium">{text(cycle.name)}</h3>
                    <p className="mt-1 text-xs text-secondary">
                      {dateLabel(cycle.start_date)} —{" "}
                      {dateLabel(cycle.end_date)} ·{" "}
                      {(
                        {
                          upcoming: "Próximo",
                          active: "Activo",
                          completed: "Completado",
                          cancelled: "Cancelado",
                        } as Record<string, string>
                      )[text(cycle.status)] || "Sin estado"}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-secondary">
                El equipo no tiene ciclos disponibles.
              </p>
            )}
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
