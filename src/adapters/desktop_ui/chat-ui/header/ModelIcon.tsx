import type { ModelIconKey } from '../../../../hooks/useModelSelector';

const PATHS: Record<ModelIconKey, React.ReactNode> = {
  // Inteligencia general: destello de cuatro puntas refinado con estrella secundaria.
  spark: (
    <>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v3M3.5 4.5h3" />
    </>
  ),
  // Reciente y rápido: rayo de alta energía.
  bolt: <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" />,
  // Razonamiento lógico: red de nodos interconectados.
  nodes: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M9.8 7.2 6.7 15.5" />
      <path d="M14.2 7.2l3.1 8.3" />
      <path d="M7.5 18h9" />
    </>
  ),
  // Ligero: hojafloresence/pluma orgánica.
  feather: (
    <>
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L3 12.5V21h8.5z" />
      <path d="M16 8 2 22" />
      <path d="M17.5 15H9" />
    </>
  ),
  // Terra / Max: globo terráqueo de alta tecnología.
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </>
  ),
  // Luna / Pro: creciente lunar estilizada.
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
};

export function ModelIcon({ icon, size = 15 }: { icon: ModelIconKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[icon]}
    </svg>
  );
}

