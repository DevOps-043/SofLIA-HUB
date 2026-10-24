import type { ProjectHubProject } from "../../services/project-hub-api";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ProjectGlyph } from "./ProjectGlyph";
import {
  count,
  dateLabel,
  projectProgress,
  record,
  relation,
  text,
} from "./dashboard-data";
import { resourceRows, type DashboardModel } from "./useProjectDashboard";
import type { ProjectSection } from "./types";

export function ProjectOverview({
  project,
  data,
  chatsCount,
  onNavigate,
}: {
  project: ProjectHubProject;
  data: DashboardModel;
  chatsCount: number;
  onNavigate: (section: ProjectSection) => void;
}) {
  const progress = projectProgress(data.analytics.data);
  const metrics = [
    {
      label: "Avance",
      value: data.analytics.loading
        ? "…"
        : progress?.percent !== null && progress?.percent !== undefined
          ? `${progress.percent} %`
          : "—",
      detail: data.analytics.error
        ? "No disponible"
        : progress
          ? progress.total
            ? `${progress.completed} de ${progress.total} tareas`
            : "Sin tareas"
          : "Sin datos",
      icon: "metrics" as const,
    },
    {
      label: "Vencidas",
      value: data.analytics.loading
        ? "…"
        : (count(record(data.analytics.data?.tasks).overdue)?.toString() ??
          "—"),
      detail: "Al corte de los datos",
      icon: "tasks" as const,
    },
    {
      label: "Hitos",
      value: "—",
      detail: "Conexión pendiente",
      icon: "milestones" as const,
    },
    {
      label: "Colaboradores",
      value: data.members.loading
        ? "…"
        : data.members.data
          ? `${data.members.data.length}${data.members.partial ? "+" : ""}`
          : "—",
      detail: data.members.error ? "No disponible" : "Miembros visibles",
      icon: "teams" as const,
    },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <div className="flex items-center gap-2 text-secondary">
              <ProjectGlyph name={metric.icon} />
              <span className="text-xs font-medium">{metric.label}</span>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-primary">
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-secondary">{metric.detail}</p>
          </Card>
        ))}
      </div>
      {data.analytics.error && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-2 text-xs text-secondary"
          role="status"
        >
          <span>{data.analytics.error}</span>
          <Button size="sm" variant="ghost" onClick={data.reload}>
            Reintentar métricas
          </Button>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <div className="space-y-5">
          <Card>
            <BlockHeading
              title="Próximos hitos"
              onClick={() => onNavigate("milestones")}
            />
            <Unavailable text="La conexión actual todavía no proporciona los hitos del proyecto." />
          </Card>
          <Card>
            <BlockHeading
              title="Tareas prioritarias"
              onClick={() => onNavigate("tasks")}
            />
            {data.tasks.loading ? (
              <Unavailable text="Cargando tareas…" />
            ) : data.tasks.error ? (
              <Unavailable text={data.tasks.error} />
            ) : !data.tasks.data?.length ? (
              <Unavailable text="Aún no hay tareas visibles." />
            ) : (
              <div className="mt-3 divide-y divide-border">
                {[...(data.tasks.data || [])]
                  .sort((a, b) => priorityRank(a) - priorityRank(b))
                  .slice(0, 4)
                  .map((task) => (
                    <div
                      key={text(task.issue_id)}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
                    >
                      <span className="min-w-0 flex-1 font-medium text-primary">
                        {text(task.title, "Sin título")}
                      </span>
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-secondary">
                        {text(relation(task.task_statuses).name, "Sin estado")}
                      </span>
                      <span className="text-secondary">
                        {text(
                          relation(task.assignee).display_name,
                          "Sin asignar",
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            {data.tasks.partial && (
              <p className="mt-2 text-xs text-secondary">
                Vista parcial de las tareas disponibles.
              </p>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <BlockHeading
              title="Ciclo activo"
              onClick={() => onNavigate("cycles")}
            />
            <Unavailable text="Los ciclos no están disponibles en esta conexión." />
          </Card>
          <Card>
            <BlockHeading
              title="Equipo asignado"
              onClick={() => onNavigate("teams")}
            />
            <Unavailable
              text={
                project.team_id
                  ? "El proyecto tiene un equipo principal. Su información ampliada no está disponible en esta conexión."
                  : "La API no informa un equipo asignado."
              }
            />
          </Card>
          <Card>
            <h2 className="text-sm font-semibold text-primary">
              Fechas del proyecto
            </h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-secondary">Inicio</dt>
                <dd>{dateLabel(project.start_date)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-secondary">Objetivo</dt>
                <dd>{dateLabel(project.target_date)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Recursos del proyecto
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {(
            [
              {
                id: "files",
                label: "Archivos",
                count: data.evidence.data
                  ? resourceRows(data.evidence.data, "files").length
                  : null,
              },
              {
                id: "web",
                label: "Páginas web",
                count: data.evidence.data
                  ? resourceRows(data.evidence.data, "web").length
                  : null,
              },
              { id: "chats", label: "Chats del proyecto", count: chatsCount },
            ] as const
          ).map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex items-center gap-3 border border-border p-4 text-left transition-colors hover:border-accent/30 focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="rounded-2xl bg-surface-2 p-2.5 text-accent">
                <ProjectGlyph
                  name={
                    item.id === "files"
                      ? "files"
                      : item.id === "web"
                        ? "web"
                        : "chats"
                  }
                />
              </span>
              <span>
                <span className="block text-xs font-semibold text-primary">
                  {item.label}
                </span>
                <span className="mt-1 block text-xs text-secondary">
                  {item.count === null
                    ? "No disponible"
                    : `${item.count}${data.evidence.partial && item.id !== "chats" ? "+" : ""} visibles`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
function BlockHeading({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-primary">{title}</h2>
      <Button
        size="sm"
        variant="ghost"
        className="!rounded-full"
        onClick={onClick}
      >
        Ver todos
      </Button>
    </div>
  );
}
function Unavailable({ text }: { text: string }) {
  return <p className="py-5 text-xs leading-relaxed text-secondary">{text}</p>;
}
function priorityRank(task: Record<string, unknown>) {
  const level = text(relation(task.task_priorities).priority_level);
  return ["urgent", "high", "medium", "low", "none"].indexOf(level) < 0
    ? 5
    : ["urgent", "high", "medium", "low", "none"].indexOf(level);
}
