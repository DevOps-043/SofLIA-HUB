import { useState } from 'react';

interface OrganizationLogoProps {
  name: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  expanded?: boolean;
}

/** Identidad sin marco; cada cambio de organización reinicia los intentos de carga. */
export function OrganizationLogo({ name, logoUrl, faviconUrl, expanded = false }: OrganizationLogoProps) {
  const sources = [...new Set([logoUrl, faviconUrl].map(url => url?.trim()).filter((url): url is string => Boolean(url)))];

  return <LogoImage key={JSON.stringify([name, ...sources])} name={name} sources={sources} expanded={expanded} />;
}

function LogoImage({ name, sources, expanded }: { name: string; sources: string[]; expanded: boolean }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = sources[sourceIndex];

  return (
    <span className={`flex shrink-0 items-center justify-start ${expanded ? 'h-10 w-36 max-w-full' : 'h-8 w-8'}`}>
      {source ? (
        <img
          key={source}
          src={source}
          alt={`Logo de ${name}`}
          className="block h-full w-full object-contain object-left"
          onError={() => setSourceIndex(sourceIndex + 1)}
        />
      ) : (
        <span aria-label={`Organización ${name}`} className="text-lg font-semibold text-accent">
          {name.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </span>
  );
}
