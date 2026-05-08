import type { ChatSpace } from '../../../services/gchat-service';
import { inputClass } from './styles';

export function SpaceSelect({
  spaces,
  value,
  onChange,
  emptyLabel,
}: {
  spaces: ChatSpace[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
}) {
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {spaces.map((space) => (
        <option key={space.name} value={space.name}>{space.displayName || space.name}</option>
      ))}
    </select>
  );
}
