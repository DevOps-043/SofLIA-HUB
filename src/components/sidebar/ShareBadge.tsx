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
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors ${
        owner ? 'bg-accent/10 text-accent' : 'bg-emerald-500/10 text-emerald-500'
      }`}
    >
      <ShareGlyph owner={owner} />
    </span>
  );
}
