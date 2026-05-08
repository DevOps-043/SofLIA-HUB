import type { DailySummary } from '../../../core/entities/ActivityLog';
import { formatSeconds } from './format';

export function SummaryInsights({ summary }: { summary: DailySummary }) {
  return (
    <>
      <div className="relative group/text">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-violet-600/30 rounded-full group-hover/text:bg-violet-600 transition-colors" />
        <div className="max-h-100 overflow-y-auto pr-4 custom-scrollbar">
          <p className="text-base text-gray-200 whitespace-pre-line leading-loose font-medium italic">
            "{summary.aiSummary}"
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ProjectsList projects={summary.projectsDetected || []} />
        <AppsList apps={summary.topApps || []} />
      </div>
    </>
  );
}

function ProjectsList({ projects }: { projects: any[] }) {
  if (projects.length === 0) return null;
  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Proyectos en Enfoque</h4>
      <div className="flex flex-wrap gap-2">
        {projects.map((project, index) => (
          <div
            key={index}
            className="group/tag px-4 py-2 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500 hover:text-white transition-all duration-300"
          >
            <span className="text-[10px] font-black uppercase tracking-tight">
              {project.projectName || project.name}
            </span>
            {project.timeSeconds > 0 && (
              <span className="ml-2 text-[9px] font-bold opacity-50 group-hover/tag:opacity-100">
                {formatSeconds(project.timeSeconds)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AppsList({ apps }: { apps: any[] }) {
  if (apps.length === 0) return null;
  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Herramientas Clave</h4>
      <div className="flex flex-wrap gap-2">
        {apps.slice(0, 4).map((app, index) => (
          <div key={index} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold text-gray-400">
            {app.name}
          </div>
        ))}
      </div>
    </div>
  );
}
