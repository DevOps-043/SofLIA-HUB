import { MonitoringActions } from './controls/MonitoringActions';
import { MonitoringNotices } from './controls/MonitoringNotices';
import { MonitoringStatusHeader } from './controls/MonitoringStatusHeader';
import { MonitoringTimer } from './controls/MonitoringTimer';
import type { MonitoringControlsProps } from './controls/types';
import { useMonitoringControlsState } from './controls/use-monitoring-controls';

export function MonitoringControls(props: MonitoringControlsProps) {
  const {
    status,
    elapsedSeconds,
    currentWindow,
    loading,
    error,
    persistError,
    isRunning,
    handleStart,
    handleStop,
  } = useMonitoringControlsState(props);

  return (
    <div className="relative group/monitor">
      <MonitoringStatusHeader isRunning={isRunning} />
      <MonitoringTimer elapsedSeconds={elapsedSeconds} currentWindow={currentWindow} isRunning={isRunning} />
      <MonitoringActions
        isRunning={isRunning}
        loading={loading}
        status={status}
        onStart={handleStart}
        onStop={handleStop}
      />
      <MonitoringNotices
        isRunning={isRunning}
        calendarEventTitle={props.calendarEventTitle}
        calendarAutoSessionId={props.calendarAutoSessionId}
        error={error}
        persistError={persistError}
        status={status}
      />
    </div>
  );
}
