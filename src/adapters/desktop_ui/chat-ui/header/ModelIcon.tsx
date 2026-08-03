import type { ModelIconKey } from '../../../../hooks/useModelSelector';

const PATHS: Record<ModelIconKey, React.ReactNode> = {
  // Inteligencia general: destello de cuatro puntas.
  spark: (
    <>
      <path d="M12 3.2 13.7 9.1 19.6 10.8 13.7 12.5 12 18.4 10.3 12.5 4.4 10.8 10.3 9.1Z" />
      <path d="M18.6 3.4 19.2 5.2 21 5.8 19.2 6.4 18.6 8.2 18 6.4 16.2 5.8 18 5.2Z" />
    </>
  ),
  // Reciente y rapido: rayo.
  bolt: <path d="M13.5 2.5 4.8 13.2h6.1l-1.4 8.3 8.7-10.7h-6.1Z" />,
  // Razonamiento logico: grafo de nodos.
  nodes: (
    <>
      <circle cx="12" cy="4.8" r="2.3" />
      <circle cx="5.4" cy="18.6" r="2.3" />
      <circle cx="18.6" cy="18.6" r="2.3" />
      <path d="M10.6 6.3 6.6 16.5M13.4 6.3l4 10.2M7.7 18.6h8.6" />
    </>
  ),
  // Ligero: pluma.
  feather: (
    <>
      <path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5Z" />
      <path d="M16 8 2.8 21.2M17.2 15H9.4" />
    </>
  ),
  // Terra: globo terraqueo.
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  // Luna: creciente.
  moon: <path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8Z" />,
};

export function ModelIcon({ icon, size = 15 }: { icon: ModelIconKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[icon]}
    </svg>
  );
}
