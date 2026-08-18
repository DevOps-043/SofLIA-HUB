import { motion, type Variants } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import type { PresentationSlide } from '../../shared/presentations/deck-schema';

type ChartSlideData = Extract<PresentationSlide, { tipo: 'grafica' }>;

const PALETTE = [
  'var(--marca-color-primario)',
  'var(--marca-color-acento)',
  'var(--marca-color-secundario)',
];

export function ChartSlide(props: {
  slide: ChartSlideData;
  reducedMotion: boolean;
  header: ReactNode;
  common: Record<string, unknown>;
  group: Variants;
  visual?: ReactNode;
}) {
  const { slide } = props;
  const data = slide.categorias.map((categoria, index) => ({
    categoria,
    ...Object.fromEntries(slide.series.map((serie) => [serie.nombre, serie.valores[index]])),
  }));

  return (
    <motion.div
      variants={props.group}
      initial="hidden"
      animate="visible"
      className={`runtime-composition runtime-composition--${slide.variante ?? 'editorial'} runtime-pad h-full pb-36 pt-24`}
    >
      {props.header}
      {slide.introduccion ? (
        <motion.p {...props.common} className="runtime-lead mt-5">{slide.introduccion}</motion.p>
      ) : null}
      <div className={`mt-10 grid items-stretch gap-7 ${props.visual ? (slide.variante === 'visual-dominante' ? 'grid-cols-[.78fr_1.22fr]' : 'grid-cols-[1.42fr_.58fr]') : 'grid-cols-1'}`}>
        <motion.section
          {...props.common}
          className="runtime-chart runtime-surface runtime-interactive h-[550px] min-w-0 p-7 shadow-[0_22px_70px_rgba(8,20,31,.10)]"
          whileHover={props.reducedMotion ? undefined : { y: -8, scale: 1.008 }}
          transition={{ type: 'spring', stiffness: 280, damping: 25 }}
          aria-label={`Grafica de ${slide.titulo}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(slide, data, props.reducedMotion)}
          </ResponsiveContainer>
        </motion.section>
        {props.visual ? (
          <motion.aside
            {...props.common}
            className="runtime-media runtime-surface runtime-interactive h-[550px] overflow-hidden rounded-[36px]"
            whileHover={props.reducedMotion ? undefined : { y: -8 }}
            transition={{ type: 'spring', stiffness: 280, damping: 25 }}
          >
            {props.visual}
          </motion.aside>
        ) : null}
      </div>
      {slide.nota ? <motion.p {...props.common} className="mt-5 text-[19px] font-semibold opacity-60">{slide.nota}</motion.p> : null}
    </motion.div>
  );
}

function renderChart(slide: ChartSlideData, data: Record<string, string | number>[], reducedMotion: boolean) {
  const common = {
    data,
    margin: { top: 20, right: 24, bottom: 24, left: 8 },
  };
  const tooltip = <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(14, 165, 164, .08)' }} />;
  const legend = <Legend wrapperStyle={{ fontSize: 17, fontWeight: 750, paddingTop: 12 }} />;
  const axes = <>
    <CartesianGrid stroke="currentColor" strokeOpacity={0.1} vertical={false} />
    <XAxis dataKey="categoria" tick={axisTick} axisLine={false} tickLine={false} dy={12} />
    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={70} unit={slide.unidad ? ` ${slide.unidad}` : undefined} />
  </>;

  if (slide.tipoGrafica === 'anillo') {
    const values = slide.categorias.map((categoria, index) => ({ categoria, valor: slide.series[0].valores[index] }));
    return <PieChart>
      <Tooltip contentStyle={tooltipStyle} />
      <Legend wrapperStyle={{ fontSize: 17, fontWeight: 750 }} />
      <Pie
        data={values}
        dataKey="valor"
        nameKey="categoria"
        cx="50%"
        cy="47%"
        innerRadius="46%"
        outerRadius="78%"
        paddingAngle={3}
        isAnimationActive={!reducedMotion}
        animationDuration={900}
      >
        {values.map((entry, index) => <Cell key={entry.categoria} fill={PALETTE[index % PALETTE.length]} />)}
      </Pie>
    </PieChart>;
  }

  if (slide.tipoGrafica === 'radar') {
    return <RadarChart {...common} cx="50%" cy="49%" outerRadius="72%">
      <PolarGrid stroke="currentColor" strokeOpacity={0.18} />
      <PolarAngleAxis dataKey="categoria" tick={axisTick} />
      <Tooltip contentStyle={tooltipStyle} />
      {legend}
      {slide.series.map((serie, index) => (
        <Radar key={serie.nombre} name={serie.nombre} dataKey={serie.nombre} stroke={PALETTE[index]} fill={PALETTE[index]} fillOpacity={0.18} strokeWidth={4} isAnimationActive={!reducedMotion} animationDuration={900} />
      ))}
    </RadarChart>;
  }

  if (slide.tipoGrafica === 'lineas') {
    return <LineChart {...common}>{axes}{tooltip}{legend}{slide.series.map((serie, index) => <Line key={serie.nombre} type="monotone" dataKey={serie.nombre} stroke={PALETTE[index]} strokeWidth={5} dot={{ r: 6, fill: PALETTE[index] }} activeDot={{ r: 10 }} isAnimationActive={!reducedMotion} animationDuration={900} />)}</LineChart>;
  }

  if (slide.tipoGrafica === 'area') {
    return <AreaChart {...common}>{axes}{tooltip}{legend}{slide.series.map((serie, index) => <Area key={serie.nombre} type="monotone" dataKey={serie.nombre} stroke={PALETTE[index]} fill={PALETTE[index]} fillOpacity={0.16} strokeWidth={4} isAnimationActive={!reducedMotion} animationDuration={900} />)}</AreaChart>;
  }

  return <BarChart {...common}>{axes}{tooltip}{legend}{slide.series.map((serie, index) => <Bar key={serie.nombre} dataKey={serie.nombre} fill={PALETTE[index]} radius={[12, 12, 0, 0]} maxBarSize={84} isAnimationActive={!reducedMotion} animationDuration={900} />)}</BarChart>;
}

const axisTick = { fill: 'currentColor', fillOpacity: 0.68, fontSize: 16, fontWeight: 650 };
const tooltipStyle = {
  background: 'var(--deck-color-superficie)',
  color: 'var(--marca-color-texto)',
  border: '1px solid color-mix(in srgb,var(--marca-color-texto) 12%,transparent)',
  borderRadius: 16,
  boxShadow: '0 14px 38px rgba(15, 23, 42, .14)',
  fontSize: 16,
  fontWeight: 650,
};
