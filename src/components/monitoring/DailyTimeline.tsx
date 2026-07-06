import type { TimelineEntry } from '../../services/monitoring-service';
import { TimelineActivityList } from './daily-timeline/TimelineActivityList';
import { TimelineBar } from './daily-timeline/TimelineBar';
import { TimelineEmptyState } from './daily-timeline/TimelineEmptyState';
import { TimelineLegend } from './daily-timeline/TimelineLegend';

interface DailyTimelineProps {
  timeline: TimelineEntry[];
}

export function DailyTimeline({ timeline }: DailyTimelineProps) {
  if (timeline.length === 0) return <TimelineEmptyState />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-gray-900 dark:text-white text-lg font-semibold">Timeline de Actividad</h3>
          <p className="text-xs text-secondary mt-0.5">Distribucion visual del tiempo</p>
        </div>
        <TimelineLegend />
      </div>
      <TimelineBar timeline={timeline} />
      <TimelineActivityList timeline={timeline} />
    </div>
  );
}
