import { TrackingToggleView } from './tracking-toggle/TrackingToggleView';
import { useTrackingSession } from './tracking-toggle/useTrackingSession';

interface TrackingToggleProps {
  userId: string;
}

export function TrackingToggle({ userId }: TrackingToggleProps) {
  const tracking = useTrackingSession(userId);
  return <TrackingToggleView {...tracking} />;
}
