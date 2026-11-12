import { useState } from 'react';

interface OrganizationLogoProps {
  name: string;
  logoUrl?: string | null;
  legacyLogoUrl?: string | null;
  faviconUrl?: string | null;
}

/** Identidad sin marco; cada cambio de organización reinicia los intentos de carga. */
export function OrganizationLogo({ name, logoUrl, legacyLogoUrl, faviconUrl }: OrganizationLogoProps) {
  const sources = [...new Set([logoUrl, legacyLogoUrl, faviconUrl].map(url => url?.trim()).filter((url): url is string => Boolean(url)))];

  return <LogoImage key={JSON.stringify([name, ...sources])} name={name} sources={sources} />;
}

function LogoImage({ name, sources }: { name: string; sources: string[] }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = sources[sourceIndex];

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-start">
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
