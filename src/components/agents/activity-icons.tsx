import type { SVGProps } from 'react';
type Props = SVGProps<SVGSVGElement> & { size?: number };
const icon = (drawing: string) => function Icon({ size = 16, ...props }: Props) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={drawing} /></svg>;
};
export const Users = icon('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M16 3a4 4 0 0 1 0 8');
export const Activity = icon('M2 12h4l3-8 6 16 3-8h4');
export const Check = icon('m5 12 4 4L19 6');
export const ChevronDown = icon('m6 9 6 6 6-6');
export const ChevronUp = icon('m6 15 6-6 6 6');
export const Circle = icon('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18');
export const Clock3 = icon('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5h5');
export const X = icon('m6 6 12 12 M6 18 18 6');
