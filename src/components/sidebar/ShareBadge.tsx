import { ShareGlyph } from './ChatIcons';

export function ShareBadge({
  owner,
  ownerTitle,
  memberTitle,
}: {
  owner: boolean;
  ownerTitle: string;
  memberTitle: string;
}) {
  return (
    <span
      title={owner ? ownerTitle : memberTitle}
      className={`shrink-0 flex items-center justify-center w-4.5 h-4.5 rounded-full transition-colors ${
        owner ? 'text-accent bg-accent/10' : 'text-emerald-500 bg-emerald-500/10'
      }`}
    >
      <ShareGlyph owner={owner} />
    </span>
  );
}
