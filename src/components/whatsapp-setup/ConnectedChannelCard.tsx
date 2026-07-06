import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface ConnectedChannelCardProps {
  phoneNumber: string | null;
  onDisconnect: () => void;
}

export function ConnectedChannelCard({ phoneNumber, onDisconnect }: ConnectedChannelCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-ping absolute inset-0" />
            <div className="w-2.5 h-2.5 rounded-full bg-success relative z-10" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-none">Canal Activo</h3>
            {phoneNumber && <p className="text-xs font-mono text-accent mt-1">+{phoneNumber}</p>}
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={onDisconnect}>
          Terminar Sesion
        </Button>
      </div>
    </Card>
  );
}
